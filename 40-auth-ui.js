// ===== 40-auth-ui.js =====
// ============================================================================
// AUTH — login screen. Role model kept backward compatible: existing
// "Administrator" / "Technician" users still work unchanged. Phase 1 adds
// two optional roles used by the Sample approval workflow (see 20-sample-
// model.js ROLE_PERMISSIONS) — "Reviewer" and "QA Manager" — but nothing
// breaks if you never create users with those roles.
// ============================================================================

// Flip to true only for local development / demos — never in a real
// deployment. When false (the default), the login screen no longer
// advertises working credentials to anyone who opens the page.
const SHOW_DEMO_CREDENTIALS = false;

// SHA-256 via the browser's built-in Web Crypto API — no external crypto
// library needed. This is still client-side hashing (there's no server to
// keep a secret pepper on until the backend migration lands), so it stops
// short of a real production auth scheme, but it's a meaningful step up from
// comparing plaintext passwords directly: a leaked users list/localStorage
// dump no longer hands over every password as-is.
async function hashPassword(plain) {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(user, enteredPassword) {
  if (user.passwordHash) {
    const enteredHash = await hashPassword(enteredPassword);
    return enteredHash === user.passwordHash;
  }
  // Legacy fallback for any user record created before this change (e.g.
  // already sitting in a browser's localStorage). Still works, but flagged
  // so it's visible in the console that this account needs re-hashing.
  if (user.password) {
    console.warn(`User "${user.username}" still has a plaintext password — log in once more after this is migrated, or recreate the account, to get a hashed password.`);
    return user.password === enteredPassword;
  }
  return false;
}

function FirstTimeSetupPage({ onSetupComplete }) {
  const [username, setUsername] = useState("admin");
  const [name, setName] = useState("System Administrator");
  const [designation, setDesignation] = useState("Senior Chemist");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) { setError("Username is required."); return; }
    if (!password) { setError("Password is required."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters long."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setSaving(true);
    setError("");
    try {
      const passwordHash = await hashPassword(password);
      const initialAdmin = {
        id: uid("user"),
        username: username.trim().toLowerCase(),
        passwordHash,
        name: name.trim() || "System Administrator",
        designation: designation.trim() || "Senior Chemist",
        role: "Administrator",
        active: true,
        createdAt: new Date().toISOString()
      };
      await DataService.save("users", initialAdmin);
      onSetupComplete(initialAdmin);
    } catch (err) {
      setError(`Failed to create admin user: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen w-full flex items-center justify-center px-4",
    style: { background: `linear-gradient(160deg, ${C.tealDark}, ${C.teal})` }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-md rounded-xl shadow-xl overflow-hidden",
    style: { background: C.card }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 pt-7 pb-5 flex flex-col items-center text-center",
    style: { background: C.tealDark }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-3 mb-2",
    style: { background: "rgba(255,255,255,0.15)" }
  }, /*#__PURE__*/React.createElement(Icon, { name: "shield", size: 28, color: "#fff" })),
  /*#__PURE__*/React.createElement("div", { className: "text-white font-semibold text-lg" }, "First-Time Admin Setup"),
  /*#__PURE__*/React.createElement("div", { className: "text-xs mt-1 text-white/80" }, "No users found in database. Create your Initial Super-Admin account.")),
  /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "px-6 py-6 flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Username",
    value: username,
    onChange: e => setUsername(e.target.value),
    placeholder: "e.g. admin",
    required: true
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Full Name",
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "e.g. System Administrator"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Designation",
    value: designation,
    onChange: e => setDesignation(e.target.value),
    placeholder: "e.g. Senior Chemist"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Initial Password (min 8 chars)",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "••••••••",
    required: true
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Confirm Password",
    type: "password",
    value: confirmPassword,
    onChange: e => setConfirmPassword(e.target.value),
    placeholder: "••••••••",
    required: true
  }), error && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    role: "alert",
    style: { color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), error),
  /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    loading: saving,
    className: "mt-2 w-full justify-center py-2.5"
  }, saving ? "Creating Account..." : "Create Admin Account & Initialize"))));
}

function LoginPage({
  users,
  onLogin
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    setChecking(true);
    const candidate = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (candidate && candidate.active === false) {
      setChecking(false);
      setError("This account has been deactivated. Contact your Administrator.");
      return;
    }
    const ok = candidate ? await verifyPassword(candidate, password) : false;
    setChecking(false);
    if (!ok) {
      setError("Invalid username or password.");
      return;
    }
    setError("");
    onLogin(candidate);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen w-full flex items-center justify-center px-4",
    style: {
      background: `linear-gradient(160deg, ${C.tealDark}, ${C.teal})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-sm rounded-xl shadow-xl overflow-hidden",
    style: {
      background: C.card
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 pt-7 pb-5 flex flex-col items-center",
    style: {
      background: C.tealDark
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-3 mb-2",
    style: {
      background: "rgba(255,255,255,0.15)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "droplet",
    size: 26,
    color: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-white font-semibold text-lg leading-tight text-center"
  }, t("appName")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-1",
    style: {
      color: C.headerTextMuted
    }
  }, t("appSub"))), /*#__PURE__*/React.createElement("form", {
    onSubmit: handleSubmit,
    className: "px-6 py-6 flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Username",
    value: username,
    onChange: e => setUsername(e.target.value),
    placeholder: "e.g. admin",
    autoFocus: true
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Password",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "••••••••"
  }), error && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    role: "alert",
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), error), /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    loading: checking,
    className: "mt-1 w-full justify-center py-2.5"
  }, !checking && /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 14
  }), checking ? "Checking…" : "Log In"))));
}

// ============================================================================
// APP ROOT — handles session / auth gate
// ============================================================================
