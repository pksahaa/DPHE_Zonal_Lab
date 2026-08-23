// ===== 40-auth-ui.js =====
// ============================================================================
// AUTH — login screen. Role model kept backward compatible: existing
// "Administrator" / "Sample Analyzer" users still work unchanged. Phase 1 adds
// two optional roles used by the Sample approval workflow (see 20-sample-
// model.js ROLE_PERMISSIONS) — "Reviewer" and "QA Manager" — but nothing
// breaks if you never create users with those roles.
// ============================================================================

// Flip to true only for local development / demos — never in a real
// deployment. When false (the default), the login screen no longer
// advertises working credentials to anyone who opens the page.
const SHOW_DEMO_CREDENTIALS = false;

// Password verification now happens on the server (see handleLogin_ /
// verifyAndMaybeMigratePassword_ in Code.gs) — the browser sends the raw
// password over HTTPS to DataService.login() and never sees, computes, or
// compares any hash itself. That closes the gap the old client-side
// SHA-256 scheme still had: previously the FULL users collection (every
// account's password hash included) had to be downloaded into the browser
// just so login could compare hashes locally, which meant anyone who
// opened the page — logged in or not — could read every password hash.
// This function is kept only as a fallback for local ("no backend
// configured") demo mode, where there's no server to verify against.
async function hashPassword(plain) {
  const bytes = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
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
      if (DataService.getConfig().mode === "gas") {
        // Server-side atomic first-run creation (handleBootstrapAdmin_ in
        // Code.gs) — verifies zero accounts exist and hashes the password
        // itself, and logs the caller straight in. Replaces the old
        // client-side "users.length === 0" check, which made that decision
        // from a copy of the list already sitting in the browser instead of
        // asking the server at the moment of creation.
        const result = await DataService.bootstrapAdmin({
          username: username.trim().toLowerCase(),
          password,
          name: name.trim() || "System Administrator",
          designation: designation.trim() || "Senior Chemist"
        });
        if (!result.ok) { setError(result.error || "Failed to create admin user."); setSaving(false); return; }
        onSetupComplete(result.user, result.token, result.expiresAt);
        return;
      }
      // Local (no backend configured) demo mode — no server to verify
      // against, so this stays a plain local record as before.
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
    // Inline flex/centering as a belt-and-suspenders fallback: this screen
    // is the very first thing to render, before Tailwind's CDN <script>
    // (loaded in index.html) is guaranteed to have finished — and on some
    // networks/deployments it never loads at all — so the card must still
    // land dead-center on plain box-model layout, not just via className.
    style: {
      background: `linear-gradient(160deg, ${C.tealDark}, ${C.teal})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      width: "100%",
      boxSizing: "border-box",
      padding: "16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-md rounded-xl shadow-xl overflow-hidden",
    style: { background: C.card, margin: "0 auto" }
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
  onLogin,
  onForgotPassword,
  noticeMessage
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault();
    setChecking(true);
    if (DataService.getConfig().mode === "gas") {
      // Server verifies the password (see handleLogin_ in Code.gs) — the
      // browser never computes or compares a hash itself, and never had to
      // download every account's hash to do it.
      let result;
      try {
        result = await DataService.login(username.trim(), password);
      } catch (err) {
        setChecking(false);
        setError(`Could not reach the backend: ${err.message}`);
        return;
      }
      setChecking(false);
      if (!result || !result.ok) {
        setError((result && result.error) || "Invalid username or password.");
        return;
      }
      setError("");
      onLogin(result.user, result.token, result.expiresAt);
      return;
    }
    // Local (no backend configured) demo mode — no server to verify
    // against, so the check happens against the locally-held record.
    const candidate = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (candidate && candidate.active === false) {
      setChecking(false);
      setError("This account has been deactivated. Contact your Administrator.");
      return;
    }
    let ok = false;
    if (candidate && candidate.passwordHash) {
      ok = (await hashPassword(password)) === candidate.passwordHash;
    } else if (candidate && candidate.password) {
      ok = candidate.password === password;
    }
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
    // Inline flex/centering fallback — see the matching note on
    // FirstTimeSetupPage above; keeps the login card centered even if the
    // Tailwind CDN <script> hasn't loaded yet (or is blocked on the
    // network) instead of leaving it stuck flush to the left edge.
    style: {
      background: `linear-gradient(160deg, ${C.tealDark}, ${C.teal})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      width: "100%",
      boxSizing: "border-box",
      padding: "16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-sm rounded-xl shadow-xl overflow-hidden",
    style: {
      background: C.card,
      margin: "0 auto"
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
  }, t("appSub"))), noticeMessage && /*#__PURE__*/React.createElement("div", {
    className: "mx-6 mt-4 px-3 py-2 rounded-md text-xs flex items-center gap-1.5",
    role: "status",
    style: { background: "rgba(11,114,133,0.08)", color: C.tealDark }
  }, /*#__PURE__*/React.createElement(Icon, { name: "clock", size: 13 }), noticeMessage),
  /*#__PURE__*/React.createElement("form", {
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
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end -mt-1.5"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onForgotPassword,
    className: "text-xs cursor-pointer bg-transparent border-none p-0",
    style: { color: C.teal }
  }, "Forgot password?")), error && /*#__PURE__*/React.createElement("div", {
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
// FORGOT / RESET PASSWORD — two-step, self-service flow.
// Step 1: the person enters their username; if that account has a recovery
// email on file (set by an Administrator on the Users screen), the server
// emails a 6-digit code that's valid for 15 minutes (handlePasswordReset
// Request_ in Code.gs).
// Step 2: the person enters that code + a new password; the server verifies
// the code against a salted hash (never stored/sent in the clear) and,
// if it matches and hasn't expired, sets the new password the same way an
// Administrator's "Reset Password" action does.
// The server deliberately returns the same generic message in step 1
// whether or not the account/email exists, so this screen can't be used to
// find out which usernames are valid.
// ============================================================================
function ForgotPasswordPage({ onDone, onBackToLogin }) {
  const [step, setStep] = useState(1); // 1 = request code, 2 = enter code + new password
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isGasMode = DataService.getConfig().mode === "gas";

  async function handleRequestCode(e) {
    e.preventDefault();
    if (!username.trim()) { setError("Enter your username first."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await DataService.requestPasswordReset(username.trim());
      setBusy(false);
      if (!result || !result.ok) {
        setError((result && result.error) || "Could not process that request.");
        return;
      }
      setInfo(result.message || "If that account has a recovery email on file, a reset code has been sent to it.");
      setStep(2);
    } catch (err) {
      setBusy(false);
      setError(`Could not reach the backend: ${err.message}`);
    }
  }

  async function handleResetWithCode(e) {
    e.preventDefault();
    if (!code.trim()) { setError("Enter the code from your email."); return; }
    if (!newPassword) { setError("New password is required."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters long."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError("");
    try {
      const result = await DataService.resetPasswordWithCode(username.trim(), code.trim(), newPassword);
      setBusy(false);
      if (!result || !result.ok) {
        setError((result && result.error) || "That code is invalid or has expired.");
        return;
      }
      onDone("Password reset. Please log in with your new password.");
    } catch (err) {
      setBusy(false);
      setError(`Could not reach the backend: ${err.message}`);
    }
  }

  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen w-full flex items-center justify-center px-4",
    style: {
      background: `linear-gradient(160deg, ${C.tealDark}, ${C.teal})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      width: "100%",
      boxSizing: "border-box",
      padding: "16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-full max-w-sm rounded-xl shadow-xl overflow-hidden",
    style: { background: C.card, margin: "0 auto" }
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-6 pt-7 pb-5 flex flex-col items-center text-center",
    style: { background: C.tealDark }
  }, /*#__PURE__*/React.createElement("div", {
    className: "rounded-full p-3 mb-2",
    style: { background: "rgba(255,255,255,0.15)" }
  }, /*#__PURE__*/React.createElement(Icon, { name: "mail", size: 26, color: "#fff" })),
  /*#__PURE__*/React.createElement("div", {
    className: "text-white font-semibold text-lg leading-tight"
  }, "Reset Password"),
  /*#__PURE__*/React.createElement("div", {
    className: "text-xs mt-1",
    style: { color: C.headerTextMuted }
  }, step === 1 ? "Enter your username to receive a reset code." : "Enter the code we sent, plus your new password.")),

  !isGasMode && /*#__PURE__*/React.createElement("div", {
    className: "mx-6 mt-4 px-3 py-2 rounded-md text-xs",
    role: "alert",
    style: { background: "rgba(217,119,6,0.1)", color: C.warn }
  }, "Self-service password reset needs the shared backend (Google Apps Script mode). Ask your Administrator to reset your password from the Users screen instead."),

  step === 1 ? /*#__PURE__*/React.createElement("form", {
    onSubmit: handleRequestCode,
    className: "px-6 py-6 flex flex-col gap-3"
  }, /*#__PURE__*/React.createElement(TextField, {
    label: "Username",
    value: username,
    onChange: e => setUsername(e.target.value),
    placeholder: "e.g. admin",
    autoFocus: true,
    disabled: !isGasMode
  }), error && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    role: "alert",
    style: { color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), error),
  /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    loading: busy,
    disabled: !isGasMode,
    className: "mt-1 w-full justify-center py-2.5"
  }, busy ? "Sending…" : "Send Reset Code"),
  /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBackToLogin,
    className: "text-xs cursor-pointer bg-transparent border-none p-0 flex items-center gap-1 justify-center mt-1",
    style: { color: C.muted }
  }, /*#__PURE__*/React.createElement(Icon, { name: "arrowLeft", size: 12 }), "Back to login"))

  : /*#__PURE__*/React.createElement("form", {
    onSubmit: handleResetWithCode,
    className: "px-6 py-6 flex flex-col gap-3"
  }, info && /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 rounded-md text-xs",
    role: "status",
    style: { background: "rgba(11,114,133,0.08)", color: C.tealDark }
  }, info),
  /*#__PURE__*/React.createElement(TextField, {
    label: "6-digit code from email",
    value: code,
    onChange: e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6)),
    placeholder: "e.g. 482913",
    inputMode: "numeric",
    autoFocus: true
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "New Password (min 8 chars)",
    type: "password",
    value: newPassword,
    onChange: e => setNewPassword(e.target.value),
    placeholder: "••••••••"
  }), /*#__PURE__*/React.createElement(TextField, {
    label: "Confirm New Password",
    type: "password",
    value: confirmPassword,
    onChange: e => setConfirmPassword(e.target.value),
    placeholder: "••••••••"
  }), error && /*#__PURE__*/React.createElement("div", {
    className: "text-xs flex items-center gap-1.5",
    role: "alert",
    style: { color: C.warn }
  }, /*#__PURE__*/React.createElement(Icon, { name: "warning", size: 13 }), error),
  /*#__PURE__*/React.createElement(Button, {
    type: "submit",
    loading: busy,
    className: "mt-1 w-full justify-center py-2.5"
  }, busy ? "Resetting…" : "Reset Password"),
  /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => { setStep(1); setError(""); },
    className: "text-xs cursor-pointer bg-transparent border-none p-0 flex items-center gap-1 justify-center mt-1",
    style: { color: C.muted }
  }, /*#__PURE__*/React.createElement(Icon, { name: "arrowLeft", size: 12 }), "Request a new code"))));
}

// ============================================================================
// APP ROOT — handles session / auth gate
// ============================================================================
