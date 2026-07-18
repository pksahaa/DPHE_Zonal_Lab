// ===== 10b-formula-engine.js =====
// ============================================================================
// FORMULA ENGINE — evaluates the calculation formulas attached to a Test
// Method's result parameters (e.g. "(A - B) * N * 1000 / V") and evaluates a
// value against a method's QC acceptance rule.
//
// Deliberately NOT using eval() or new Function(): formulas here are
// authored by lab staff through the Test Method Engine UI and may end up
// being run many times per day against live data, so this is a small
// hand-rolled recursive-descent parser over a strict grammar (numbers,
// named variables, + - * / ^, parentheses, unary minus, and a short
// allow-list of math functions). Anything outside that grammar is a
// reported error, never silently executed.
// ============================================================================

const FORMULA_FUNCTIONS = {
  abs: Math.abs,
  round: (x, d = 0) => {
    const f = Math.pow(10, d);
    return Math.round(x * f) / f;
  },
  min: (...xs) => Math.min(...xs),
  max: (...xs) => Math.max(...xs),
  sqrt: Math.sqrt,
  log10: Math.log10,
  ln: Math.log
};
function tokenizeFormula(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push({
        type: "num",
        value: parseFloat(src.slice(i, j))
      });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      tokens.push({
        type: "ident",
        value: src.slice(i, j)
      });
      i = j;
      continue;
    }
    if ("+-*/^(),".includes(ch)) {
      tokens.push({
        type: ch
      });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}" in formula.`);
  }
  return tokens;
}

// Grammar (lowest to highest precedence):
//   expr   := term (('+'|'-') term)*
//   term   := power (('*'|'/') power)*
//   power  := unary ('^' unary)?
//   unary  := '-' unary | atom
//   atom   := number | ident '(' args ')' | ident | '(' expr ')'
function parseFormula(tokens, variables) {
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = type => {
    const t = tokens[pos];
    if (!t || t.type !== type) throw new Error(`Expected "${type}" in formula.`);
    pos++;
    return t;
  };
  function parseExpr() {
    let v = parseTerm();
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const op = eat(peek().type).type;
      const rhs = parseTerm();
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseTerm() {
    let v = parsePower();
    while (peek() && (peek().type === "*" || peek().type === "/")) {
      const op = eat(peek().type).type;
      const rhs = parsePower();
      if (op === "/" && rhs === 0) throw new Error("Division by zero.");
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  function parsePower() {
    const base = parseUnary();
    if (peek() && peek().type === "^") {
      eat("^");
      return Math.pow(base, parseUnary());
    }
    return base;
  }
  function parseUnary() {
    if (peek() && peek().type === "-") {
      eat("-");
      return -parseUnary();
    }
    return parseAtom();
  }
  function parseAtom() {
    const t = peek();
    if (!t) throw new Error("Unexpected end of formula.");
    if (t.type === "num") {
      eat("num");
      return t.value;
    }
    if (t.type === "(") {
      eat("(");
      const v = parseExpr();
      eat(")");
      return v;
    }
    if (t.type === "ident") {
      eat("ident");
      if (peek() && peek().type === "(") {
        eat("(");
        const args = [];
        if (peek() && peek().type !== ")") {
          args.push(parseExpr());
          while (peek() && peek().type === ",") {
            eat(",");
            args.push(parseExpr());
          }
        }
        eat(")");
        const fn = FORMULA_FUNCTIONS[t.value];
        if (!fn) throw new Error(`Unknown function "${t.value}()". Allowed: ${Object.keys(FORMULA_FUNCTIONS).join(", ")}.`);
        return fn(...args);
      }
      if (!(t.value in variables)) throw new Error(`Unknown variable "${t.value}" — check it matches an input key exactly.`);
      const v = Number(variables[t.value]);
      if (Number.isNaN(v)) throw new Error(`Variable "${t.value}" is not a number.`);
      return v;
    }
    throw new Error(`Unexpected token in formula near "${t.type}".`);
  }
  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Unexpected trailing content in formula.");
  return result;
}

// variables: { [key]: number }
function evaluateFormula(formula, variables) {
  if (!formula || !formula.trim()) return {
    ok: false,
    error: "No formula defined."
  };
  try {
    const tokens = tokenizeFormula(formula);
    const value = parseFormula(tokens, variables || {});
    if (!Number.isFinite(value)) return {
      ok: false,
      error: "Formula did not evaluate to a finite number."
    };
    return {
      ok: true,
      value
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message
    };
  }
}

// ---- QC rule evaluation -------------------------------------------------
const QC_RULE_TYPES = [{
  value: "blank",
  label: "Blank"
}, {
  value: "duplicate",
  label: "Duplicate (RPD %)"
}, {
  value: "spike",
  label: "Spike / Recovery (%)"
}, {
  value: "calibration",
  label: "Calibration Curve (R²)"
}, {
  value: "other",
  label: "Other"
}];
const QC_COMPARATORS = [{
  value: "lt",
  label: "< (less than)"
}, {
  value: "lte",
  label: "≤ (less than or equal)"
}, {
  value: "gt",
  label: "> (greater than)"
}, {
  value: "gte",
  label: "≥ (greater than or equal)"
}, {
  value: "between",
  label: "Between (inclusive range)"
}];
function qcComparatorLabel(rule) {
  if (rule.comparator === "between") return `between ${fmtNum(rule.limitLow)} and ${fmtNum(rule.limitHigh)}${rule.unit ? " " + rule.unit : ""}`;
  const symbols = {
    lt: "<",
    lte: "≤",
    gt: ">",
    gte: "≥"
  };
  return `${symbols[rule.comparator] || rule.comparator} ${fmtNum(rule.limitLow)}${rule.unit ? " " + rule.unit : ""}`;
}
function evaluateQcRule(rule, value) {
  const v = Number(value);
  if (Number.isNaN(v)) return {
    pass: null,
    message: "Enter a numeric value to check against this rule."
  };
  let pass;
  switch (rule.comparator) {
    case "lt":
      pass = v < rule.limitLow;
      break;
    case "lte":
      pass = v <= rule.limitLow;
      break;
    case "gt":
      pass = v > rule.limitLow;
      break;
    case "gte":
      pass = v >= rule.limitLow;
      break;
    case "between":
      pass = v >= rule.limitLow && v <= rule.limitHigh;
      break;
    default:
      return {
        pass: null,
        message: "Unknown comparator."
      };
  }
  return {
    pass,
    message: pass ? `Pass — ${fmtNum(v)} is ${qcComparatorLabel(rule)}.` : `Fail — ${fmtNum(v)} is NOT ${qcComparatorLabel(rule)}.`
  };
}
