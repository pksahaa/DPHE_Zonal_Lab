// ============================================================================
// SAMPLE LIFECYCLE UI — the "Samples" tab. Reuses 02-ui-kit primitives so it
// looks native to the rest of the app. Talks to samples ONLY through the
// props passed down from 99-app.js's useSamples() hook (DataService-backed),
// never touching storage directly.
// ============================================================================

function SampleStatusBadge({ status }) {
  const meta = sampleStatusMeta(status);
  const toneMap = { info: C.teal, warn: C.warn, ok: C.ok };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${toneMap[meta.color]}1A`, color: toneMap[meta.color] }}>
      <Icon name={meta.icon} size={11} />{meta.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const urgent = priority === "Urgent";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: urgent ? `${C.warn}1A` : `${C.muted}1A`, color: urgent ? C.warn : C.muted }}>
      {priority}
    </span>
  );
}

// ---- Registration form ----
function SampleRegistrationForm({ testTypes, onCreate, onClose }) {
  const [form, setForm] = React.useState({
    clientName: "", siteLocation: "", matrix: "Drinking Water", collectionDate: todayStr(),
    collectedBy: "", receivedDate: todayStr(), priority: "Routine", notes: "",
  });
  const [selectedTests, setSelectedTests] = React.useState([]);
  const [err, setErr] = React.useState("");

  function toggleTest(t) {
    setSelectedTests((prev) => prev.some((x) => x.testTypeId === t.id)
      ? prev.filter((x) => x.testTypeId !== t.id)
      : [...prev, { testTypeId: t.id, testTypeName: t.name }]);
  }

  function submit() {
    if (!form.clientName.trim() || !form.siteLocation.trim()) { setErr("Client / requester and site location are required."); return; }
    if (!selectedTests.length) { setErr("Select at least one requested test."); return; }
    onCreate({ ...form, requestedTests: selectedTests });
  }

  return (
    <Modal title="Register New Sample" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <TextField simple label="Client / Requester" value={form.clientName} onChange={(v) => setForm({ ...form, clientName: v })} />
        <TextField simple label="Site / Location" value={form.siteLocation} onChange={(v) => setForm({ ...form, siteLocation: v })} />
        <SelectField simple label="Matrix" value={form.matrix} onChange={(v) => setForm({ ...form, matrix: v })}
          options={["Drinking Water", "Ground Water", "Surface Water", "Wastewater", "Other"]} />
        <SelectField simple label="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })}
          options={["Routine", "Urgent"]} />
        <TextField simple label="Collection Date" type="date" value={form.collectionDate} onChange={(v) => setForm({ ...form, collectionDate: v })} />
        <TextField simple label="Collected By" value={form.collectedBy} onChange={(v) => setForm({ ...form, collectedBy: v })} />
        <TextField simple label="Received Date" type="date" value={form.receivedDate} onChange={(v) => setForm({ ...form, receivedDate: v })} />
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium mb-1.5" style={{ color: C.muted }}>Requested Tests</div>
        <div className="flex flex-wrap gap-1.5">
          {testTypes.map((t) => {
            const on = selectedTests.some((x) => x.testTypeId === t.id);
            return (
              <button key={t.id} onClick={() => toggleTest(t)} className="px-2.5 py-1 rounded-full text-xs font-medium border"
                style={{ background: on ? C.teal : "transparent", color: on ? "#fff" : C.ink, borderColor: on ? C.teal : C.border }}>
                {t.testName || t.name}
              </button>
            );
          })}
          {!testTypes.length && <div className="text-xs" style={{ color: C.muted }}>No test methods configured yet — add one in Test Method Engine first.</div>}
        </div>
      </div>

      <div className="mt-3">
        <TextField simple label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea />
      </div>

      {err && <div className="mt-2 text-xs font-medium" style={{ color: C.warn }}>{err}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}><Icon name="check" size={13} />Register Sample</Button>
      </div>
    </Modal>
  );
}

// ---- Chain of custody timeline ----
function CustodyTimeline({ events }) {
  return (
    <div className="space-y-0">
      {events.map((e, i) => (
        <div key={e.id} className="flex gap-3 pb-3">
          <div className="flex flex-col items-center">
            <span className="rounded-full" style={{ width: 8, height: 8, background: C.teal, marginTop: 4 }} />
            {i < events.length - 1 && <span style={{ width: 1, flex: 1, background: C.border, marginTop: 2 }} />}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: C.ink }}>{e.action}</span>
              <span className="text-[11px]" style={{ color: C.muted }}>{new Date(e.ts).toLocaleString()}</span>
            </div>
            <div className="text-[11px]" style={{ color: C.muted }}>
              {e.fromUser ? `${e.fromUser} → ` : ""}{e.toUser}{e.location ? ` · ${e.location}` : ""}
            </div>
            {e.notes && <div className="text-xs mt-0.5" style={{ color: C.ink }}>{e.notes}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- e-signature capture ----
function SignatureCapture({ user, onConfirm, label }) {
  const [signedName, setSignedName] = React.useState("");
  const [attested, setAttested] = React.useState(false);
  const [comment, setComment] = React.useState("");
  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: C.bg, border: `1px dashed ${C.border}` }}>
      <div className="text-xs font-semibold mb-2" style={{ color: C.ink }}>{label}</div>
      <TextField simple label="Comment (optional)" value={comment} onChange={setComment} textarea />
      <TextField simple label="Type your full name to sign" value={signedName} onChange={setSignedName} placeholder={user?.name || ""} />
      <label className="flex items-center gap-2 mt-2 text-xs" style={{ color: C.ink }}>
        <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
        I attest that this decision reflects my professional review of the results.
      </label>
      <div className="text-[10px] mt-1" style={{ color: C.muted }}>
        Workflow-level electronic signature (typed name + attestation + timestamp). Not a cryptographic signature.
      </div>
      <div className="flex justify-end gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={() => onConfirm({ decision: "rejected", comment, signedName, attested })}>
          <Icon name="warning" size={12} />Reject
        </Button>
        <Button size="sm" onClick={() => onConfirm({ decision: "approved", comment, signedName, attested })}>
          <Icon name="check" size={12} />Sign &amp; Approve
        </Button>
      </div>
    </div>
  );
}

// ---- Sample detail drawer ----
function SampleDetail({ sample, users, session, testRecords, onClose, onUpdate, notify }) {
  const perms = permissionsFor(session.role);
  const allowedNext = nextAllowedStatuses(sample);
  const technicians = users.filter((u) => u.role === "Technician" || u.role === "Administrator");
  const [assignee, setAssignee] = React.useState(sample.assignedTo || "");

  function guardedUpdate(mutator, successMsg) {
    try {
      const next = mutator();
      onUpdate(next);
      notify?.(successMsg, "ok");
    } catch (e) {
      notify?.(e.message, "warn");
    }
  }

  const step = sample.status === "results_entered" ? "review" : sample.status === "under_review" ? "approve" : null;
  const canActOnStep = step === "review" ? perms.canReview : step === "approve" ? perms.canApprove : false;

  return (
    <Modal title={`${sample.sampleCode} — ${sample.clientName}`} onClose={onClose} wide>
      <div className="flex items-center gap-2 mb-3">
        <SampleStatusBadge status={sample.status} />
        <PriorityBadge priority={sample.priority} />
        <span className="text-xs" style={{ color: C.muted }}>{sample.matrix} · {sample.siteLocation}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Requested Tests</div>
            <div className="flex flex-wrap gap-1.5">
              {sample.requestedTests.map((t) => (
                <span key={t.testTypeId} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${C.teal}1A`, color: C.tealDark }}>{t.testTypeName}</span>
              ))}
            </div>
            {!!sample.linkedTestRecordIds.length && (
              <div className="text-[11px] mt-1.5" style={{ color: C.muted }}>
                Linked test records: {sample.linkedTestRecordIds.length} (see Test Records tab)
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Chain of Custody</div>
            <CustodyTimeline events={sample.custodyLog} />
          </div>

          {sample.approvals.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Approval History</div>
              {sample.approvals.map((a) => (
                <div key={a.id} className="text-xs mb-1.5 p-2 rounded" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex justify-between">
                    <span className="font-medium" style={{ color: a.decision === "approved" ? C.ok : C.warn }}>
                      {a.step === "review" ? "Review" : "Approval"}: {a.decision}
                    </span>
                    <span style={{ color: C.muted }}>{new Date(a.ts).toLocaleString()}</span>
                  </div>
                  <div style={{ color: C.muted }}>Signed by {a.signature.signedName} ({a.byRole})</div>
                  {a.comment && <div className="mt-0.5" style={{ color: C.ink }}>{a.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {sample.status === "received" && perms.canAssign && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Assign Technician</div>
              <SelectField simple value={assignee} onChange={setAssignee} options={technicians.map((t) => t.name)} placeholder="Select technician" />
              <Button size="sm" className="mt-2" disabled={!assignee}
                onClick={() => guardedUpdate(() => assignSample(sample, assignee, session), `Assigned to ${assignee}.`)}>
                <Icon name="user" size={12} />Assign
              </Button>
            </div>
          )}

          {!!allowedNext.length && !["received", "results_entered", "under_review"].includes(sample.status) && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Move Status</div>
              <div className="flex flex-wrap gap-1.5">
                {allowedNext.map((s) => (
                  <Button key={s} size="sm" variant="outline"
                    onClick={() => guardedUpdate(() => transitionSample(sample, s, {}, session), `Status updated to ${sampleStatusMeta(s).label}.`)}>
                    {sampleStatusMeta(s).label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {step && (
            canActOnStep ? (
              <SignatureCapture user={session} label={step === "review" ? "Technical Review" : "Final Approval"}
                onConfirm={(sig) => guardedUpdate(() => addApproval(sample, { step, ...sig }, session), "Decision recorded.")} />
            ) : (
              <div className="text-xs p-2 rounded" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
                Waiting on a {step === "review" ? "Reviewer" : "QA Manager / Administrator"} to sign off.
              </div>
            )
          )}

          {sample.status === "approved" && perms.canRelease && (
            <div>
              <div className="text-xs font-semibold mb-1" style={{ color: C.ink }}>Release Results</div>
              <Button size="sm" onClick={() => guardedUpdate(() => releaseResults(sample, session, ""), "Results released.")}>
                <Icon name="printer" size={12} />Release to Client
              </Button>
            </div>
          )}

          {sample.status === "released" && (
            <div className="text-xs p-2 rounded" style={{ background: C.okBg, color: C.ok, border: `1px solid ${C.ok}` }}>
              Released by {sample.resultRelease.releasedBy} on {new Date(sample.resultRelease.releasedAt).toLocaleString()}.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---- main tab: list + registration + detail ----
function SamplesTab({ samples, setSamples, testTypes, testRecords, users, session, notify }) {
  const [showForm, setShowForm] = React.useState(false);
  const [openId, setOpenId] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [q, setQ] = React.useState("");

  const perms = permissionsFor(session.role);
  const openSample = samples.find((s) => s.id === openId) || null;

  const filtered = samples.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (q && !`${s.sampleCode} ${s.clientName} ${s.siteLocation}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  async function handleCreate(fields) {
    const sample = createSample(fields, samples, session);
    await setSamples((prev) => [sample, ...prev], sample);
    setShowForm(false);
    notify?.(`${sample.sampleCode} registered.`, "ok");
  }
  async function handleUpdate(next) {
    await setSamples((prev) => prev.map((s) => (s.id === next.id ? next : s)), next);
  }

  const stats = sampleLifecycleStats(samples);

  return (
    <div>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold" style={{ color: C.ink }}>Sample Lifecycle</h2>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Registration, chain of custody, assignment, approval and result release.</div>
        </div>
        {perms.canRegister && (
          <Button onClick={() => setShowForm(true)}><Icon name="clipboard" size={13} />Register New Sample</Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Active Samples" value={stats.activeCount} icon="beaker" />
        <StatCard label="Pending Review" value={stats.pendingApproval} icon="chart" tone={stats.pendingApproval ? "warn" : "ink"} />
        <StatCard label="Awaiting Release" value={stats.awaitingRelease} icon="printer" />
        <StatCard label="Overdue" value={stats.overdue} icon="warning" tone={stats.overdue ? "warn" : "ink"} />
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sample code, client, site…"
          className="px-3 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.ink, minWidth: 240 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.border}`, background: C.card, color: C.ink }}>
          <option value="">All statuses</option>
          {SAMPLE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.bg }}>
              {["Sample Code", "Client", "Site", "Matrix", "Priority", "Status", "Assigned To", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold" style={{ color: C.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="cursor-pointer" style={{ borderTop: `1px solid ${C.border}` }} onClick={() => setOpenId(s.id)}>
                <td className="px-3 py-2 font-medium" style={{ color: C.ink }}>{s.sampleCode}</td>
                <td className="px-3 py-2" style={{ color: C.ink }}>{s.clientName}</td>
                <td className="px-3 py-2" style={{ color: C.muted }}>{s.siteLocation}</td>
                <td className="px-3 py-2" style={{ color: C.muted }}>{s.matrix}</td>
                <td className="px-3 py-2"><PriorityBadge priority={s.priority} /></td>
                <td className="px-3 py-2"><SampleStatusBadge status={s.status} /></td>
                <td className="px-3 py-2" style={{ color: C.muted }}>{s.assignedTo || "—"}</td>
                <td className="px-3 py-2 text-right"><Icon name="chevronRight" size={14} color={C.muted} /></td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: C.muted }}>No samples match. Register one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <SampleRegistrationForm testTypes={testTypes} onCreate={handleCreate} onClose={() => setShowForm(false)} />}
      {openSample && (
        <SampleDetail sample={openSample} users={users} session={session} testRecords={testRecords}
          onClose={() => setOpenId(null)} onUpdate={handleUpdate} notify={notify} />
      )}
    </div>
  );
}
