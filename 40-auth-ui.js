// ===== 40-auth-ui.js =====
// ============================================================================
// AUTH — login screen. Role model kept backward compatible: existing
// "Administrator" / "Technician" users still work unchanged. Phase 1 adds
// two optional roles used by the Sample approval workflow (see 20-sample-
// model.js ROLE_PERMISSIONS) — "Reviewer" and "QA Manager" — but nothing
// breaks if you never create users with those roles.
// ============================================================================
function LoginPage({
  users,
  onLogin
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  function handleSubmit(e) {
    e.preventDefault();
    const match = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password);
    if (!match) {
      setError("Invalid username or password.");
      return;
    }
    setError("");
    onLogin(match);
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
      color: "#BFE3E0"
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
    style: {
      color: C.warn
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "warning",
    size: 13
  }), error), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "mt-1 w-full rounded font-medium text-sm py-2.5 flex items-center justify-center gap-1.5",
    style: {
      background: C.teal,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "lock",
    size: 14
  }), "Log In"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-center mt-2 rounded p-2",
    style: {
      color: C.muted,
      background: "#EEF4F3"
    }
  }, "Demo accounts — ", /*#__PURE__*/React.createElement("strong", null, "admin / admin123"), " (Administrator) or ", /*#__PURE__*/React.createElement("strong", null, "tester / tester123"), " (Technician)"))));
}

// ============================================================================
// APP ROOT — handles session / auth gate
// ============================================================================
