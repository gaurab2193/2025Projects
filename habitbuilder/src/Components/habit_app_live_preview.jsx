import React, { useEffect, useMemo, useRef, useState } from "react";
import "./habit_app_live_preview.css";

function calculateXP(base = 10, difficulty = 1, streak = 1) {
  const streakBonus = Math.min(streak, 10);
  return Math.round(base * difficulty + 0.5 * streakBonus);
}
function weekCount(history = []) {
  const now = Date.now(), weekAgo = now - 7 * 86400000;
  return history.filter(t => new Date(t).getTime() >= weekAgo).length;
}
/* Clean up CSV input and strip any leading bullets/dashes/asterisks */
function cleanTasksCSV(csv) {
  return csv
    .split(",")
    .map(s => s.replace(/^[\s•\-–—*]+/, "").trim())
    .filter(Boolean);
}

function HabitCard({ habit, onDone, onReset, onDelete, onEdit }) {
  const w = weekCount(habit.history);
  const progress = Math.min(w / (habit.targetDays || 5), 1);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="title">{habit.name}</h3>
        <div className="card-actions">
          <button className="btn-ghost-sm info" onClick={onEdit} title="Edit this habit">✎ Edit</button>
          <button className="btn-ghost-sm warn" onClick={onReset} title="Reset this habit’s streak & XP">🧹 Reset</button>
          <button className="btn-ghost-sm danger" onClick={onDelete} title="Delete this habit">🗑️ Delete</button>
          <button className="btn" onClick={onDone}>Mark done</button>
        </div>
      </div>

      {habit.ifThen && <p className="sub">{habit.ifThen}</p>}

      {habit.tasks?.length > 0 && (
        <ul className="tasks">
          {habit.tasks.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      <div className="card-footer">
        <div className="meta">
          <span>🔥 <b>Streak</b> {habit.streak || 0}</span>
          <span>·</span>
          <span><b>XP</b> {habit.xp || 0}</span>
        </div>
        <div className="week">This week: {w}×</div>
      </div>

      <div className="progress">
        <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export default function HabitAppLivePreview() {
  const LS_STATE = "habitGardenState_v1";
  const LS_THEME = "habitTheme_vivid";

  // Theme
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(LS_THEME);
    return saved === "light" || saved === "dark" ? saved : "light";
  });
  useEffect(() => localStorage.setItem(LS_THEME, theme), [theme]);

  // Data
  const [habits, setHabits] = useState(() => {
    try { const raw = localStorage.getItem(LS_STATE); if (raw) return JSON.parse(raw); } catch {}
    const id = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    return [
      { id: id(), name: "Morning Walk", ifThen: "If it is 7:00 AM, then I will walk right after coffee.",
        tasks:["Shoes on","Fill bottle","10-min route"], difficulty:1, targetDays:5, streak:0, xp:0, lastDone:null, history:[] },
      { id: id(), name: "Deep Work (25m)", ifThen: "If it is 9:30 AM, then I will start a 25m focus block.",
        tasks:["Phone on DND","One task","Timer on"], difficulty:2, targetDays:5, streak:0, xp:0, lastDone:null, history:[] }
    ];
  });
  useEffect(() => localStorage.setItem(LS_STATE, JSON.stringify(habits)), [habits]);

  // One-time cleanup: strip leading bullets/dashes from any saved tasks
  const didCleanRef = useRef(false);
  useEffect(() => {
    if (didCleanRef.current) return;
    setHabits(prev => prev.map(h => ({
      ...h,
      tasks: (h.tasks || []).map(t => t.replace(/^[\s•\-–—*]+/, "").trim())
    })));
    didCleanRef.current = true;
  }, []);

  const totalXP = useMemo(() => habits.reduce((a,b)=>a+(b.xp||0),0), [habits]);

  // Confetti
  const rootRef = useRef(null), canvasRef = useRef(null);
  const confettiRef = useRef({ pieces: [], animating: false });
  useEffect(() => {
    const root = rootRef.current, c = canvasRef.current; if (!root || !c) return;
    const ro = new ResizeObserver(() => {
      const r = root.getBoundingClientRect(); c.width = r.width; c.height = r.height;
    }); ro.observe(root); return () => ro.disconnect();
  }, []);
  function burst(){
    const root = rootRef.current, c = canvasRef.current, ctx = c.getContext("2d");
    const g = getComputedStyle(root);
    const colors = [g.getPropertyValue("--accent-1"), g.getPropertyValue("--accent-2"), g.getPropertyValue("--accent-3"), g.getPropertyValue("--accent-4")]
      .map(s=>s.trim());
    const r = root.getBoundingClientRect();
    for (let i=0;i<100;i++){
      confettiRef.current.pieces.push({ x:r.width/2, y:r.height*0.2, vx:(Math.random()-0.5)*6, vy:Math.random()*-6-2, g:0.16,
        size:4+Math.random()*4, color:colors[Math.floor(Math.random()*colors.length)], life:60+Math.random()*30, rot:Math.random()*Math.PI });
    }
    if (!confettiRef.current.animating) animate();
    function animate(){
      confettiRef.current.animating = true;
      ctx.clearRect(0,0,c.width,c.height);
      confettiRef.current.pieces.forEach(p=>{ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=0.1; p.life-=1;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size); ctx.restore();
      });
      confettiRef.current.pieces = confettiRef.current.pieces.filter(p=>p.life>0 && p.y<c.height+20);
      if (confettiRef.current.pieces.length>0) requestAnimationFrame(animate); else confettiRef.current.animating = false;
    }
  }

  // Actions
  function markDone(id){
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const now = new Date();
      const last = h.lastDone ? new Date(h.lastDone) : null;
      let streak = h.streak || 0;
      if (last) {
        const diffDays = Math.floor((now - last)/86400000);
        if (diffDays === 1) streak += 1;
        else if (diffDays > 1) streak = 1;
      } else streak = 1;
      const gained = calculateXP(10, h.difficulty, streak);
      burst();
      return { ...h, streak, xp:(h.xp||0)+gained, lastDone: now.toISOString(), history:[...(h.history||[]), now.toISOString()] };
    }));
  }
  function resetHabit(id){
    if (!window.confirm("Reset streak & XP for this habit?")) return;
    setHabits(prev => prev.map(h => h.id === id ? { ...h, streak:0, xp:0, lastDone:null, history:[] } : h));
  }
  function deleteHabit(id){
    if (!window.confirm("Delete this habit? This cannot be undone.")) return;
    setHabits(prev => prev.filter(h => h.id !== id));
  }

  // Add Habit modal
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:"", ifThen:"", tasks:"", difficulty:1, targetDays:5 });

  // --- Custom Dropdown (Add) ---
  const diffOptions = useMemo(() => [
    { value: 1, label: "Easy" },
    { value: 2, label: "Medium" },
    { value: 3, label: "Tough" },
  ], []);
  const [addSelOpen, setAddSelOpen] = useState(false);
  const [addSelActive, setAddSelActive] = useState(0);
  const addSelBtnRef = useRef(null);
  const addSelListRef = useRef(null);
  const addIndex = Math.max(0, diffOptions.findIndex(o => String(o.value) === String(form.difficulty)));

  useEffect(() => {
    function onDoc(e){
      if (!addSelOpen) return;
      if (!addSelBtnRef.current?.contains(e.target) && !addSelListRef.current?.contains(e.target)) {
        setAddSelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [addSelOpen]);

  function onAddSelKeyDown(e){
    if (!addSelOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")){
      e.preventDefault(); setAddSelOpen(true); return;
    }
    if (!addSelOpen) return;
    if (e.key === "ArrowDown"){ e.preventDefault(); setAddSelActive(i => Math.min(i+1, diffOptions.length-1)); }
    if (e.key === "ArrowUp"){ e.preventDefault(); setAddSelActive(i => Math.max(i-1, 0)); }
    if (e.key === "Home"){ e.preventDefault(); setAddSelActive(0); }
    if (e.key === "End"){ e.preventDefault(); setAddSelActive(diffOptions.length-1); }
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      const opt = diffOptions[addSelActive];
      setForm({ ...form, difficulty: Number(opt.value) });
      setAddSelOpen(false);
      addSelBtnRef.current?.focus();
    }
    if (e.key === "Escape"){ e.preventDefault(); setAddSelOpen(false); addSelBtnRef.current?.focus(); }
  }
  // --------------------------------

  function addHabit(){
    if (!form.name.trim()) return;
    const id = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
    const tasks = cleanTasksCSV(form.tasks);
    setHabits(prev => [...prev, {
      id: id(), name: form.name.trim(), ifThen: form.ifThen.trim(), tasks,
      difficulty: Number(form.difficulty||1), targetDays: Number(form.targetDays||5),
      streak:0, xp:0, lastDone:null, history:[]
    }]);
    setOpen(false);
    setForm({ name:"", ifThen:"", tasks:"", difficulty:1, targetDays:5 });
  }

  // Edit Habit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ name:"", ifThen:"", tasks:"", difficulty:1, targetDays:5 });

  // --- Custom Dropdown (Edit) ---
  const [editSelOpen, setEditSelOpen] = useState(false);
  const [editSelActive, setEditSelActive] = useState(0);
  const editSelBtnRef = useRef(null);
  const editSelListRef = useRef(null);
  const editIndex = Math.max(0, diffOptions.findIndex(o => String(o.value) === String(editForm.difficulty)));

  useEffect(() => {
    function onDoc(e){
      if (!editSelOpen) return;
      if (!editSelBtnRef.current?.contains(e.target) && !editSelListRef.current?.contains(e.target)) {
        setEditSelOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [editSelOpen]);

  function onEditSelKeyDown(e){
    if (!editSelOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")){
      e.preventDefault(); setEditSelOpen(true); return;
    }
    if (!editSelOpen) return;
    if (e.key === "ArrowDown"){ e.preventDefault(); setEditSelActive(i => Math.min(i+1, diffOptions.length-1)); }
    if (e.key === "ArrowUp"){ e.preventDefault(); setEditSelActive(i => Math.max(i-1, 0)); }
    if (e.key === "Home"){ e.preventDefault(); setEditSelActive(0); }
    if (e.key === "End"){ e.preventDefault(); setEditSelActive(diffOptions.length-1); }
    if (e.key === "Enter" || e.key === " "){
      e.preventDefault();
      const opt = diffOptions[editSelActive];
      setEditForm({ ...editForm, difficulty: Number(opt.value) });
      setEditSelOpen(false);
      editSelBtnRef.current?.focus();
    }
    if (e.key === "Escape"){ e.preventDefault(); setEditSelOpen(false); editSelBtnRef.current?.focus(); }
  }
  // --------------------------------

  function startEdit(h){
    setEditId(h.id);
    setEditForm({
      name: h.name || "",
      ifThen: h.ifThen || "",
      tasks: (h.tasks || []).join(", "),
      difficulty: Number(h.difficulty || 1),
      targetDays: Number(h.targetDays || 5)
    });
    setEditOpen(true);
  }
  function saveEdit(){
    if (!editId) return;
    setHabits(prev => prev.map(h => {
      if (h.id !== editId) return h;
      return {
        ...h,
        name: editForm.name.trim() || h.name,
        ifThen: editForm.ifThen.trim(),
        tasks: cleanTasksCSV(editForm.tasks),
        difficulty: Number(editForm.difficulty || 1),
        targetDays: Number(editForm.targetDays || 5),
      };
    }));
    setEditOpen(false); setEditId(null);
  }

  return (
    <div className="hg" data-theme={theme} ref={rootRef}>
      <div className="bgwash" />
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <div className="logo" />
            <div className="brand-text">
              <div className="brand-title">Habit Garden</div>
              <div className="brand-sub">Science-based habit builder</div>
            </div>
          </div>
          <div className="actions">
            <span className="pill">XP {totalXP}</span>
            <button className="btn-ghost" onClick={()=>setOpen(true)}>+ Add Habit</button>
            <button className="btn-ghost" onClick={()=>setTheme(theme==="light"?"dark":"light")}>
              {theme === "light" ? "Dark" : "Light"}
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        {habits.length === 0 ? (
          <div className="empty">No habits yet. Click <b>+ Add Habit</b> to get started.</div>
        ) : (
          <section className="grid">
            {habits.map(h => (
              <HabitCard
                key={h.id}
                habit={h}
                onDone={() => markDone(h.id)}
                onReset={() => resetHabit(h.id)}
                onDelete={() => deleteHabit(h.id)}
                onEdit={() => startEdit(h)}
              />
            ))}
          </section>
        )}
      </main>

      <canvas id="confetti" ref={canvasRef} />

      {/* Add Modal */}
      {open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
              <h3 style={{margin:0}}>New Habit</h3>
              <button className="btn-ghost" onClick={()=>setOpen(false)}>✕</button>
            </div>

            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}
                     placeholder="e.g., Morning Walk (10 min)" />
            </div>
            <div className="field">
              <label className="label">If–Then Plan</label>
              <input className="input" value={form.ifThen} onChange={e=>setForm({...form, ifThen:e.target.value})}
                     placeholder="If it's 7:00 AM, then I will…" />
            </div>
            <div className="field">
              <label className="label">Micro-tasks (comma-separated)</label>
              <input className="input" value={form.tasks} onChange={e=>setForm({...form, tasks:e.target.value})}
                     placeholder="Shoes on, Fill bottle, 10-min route" />
            </div>

            <div className="row" style={{gap:12}}>
              <div className="field" style={{flex:1}}>
                <label className="label">Difficulty</label>

                {/* Custom Select (Add) */}
                <div className="hf-select">
                  <button
                    ref={addSelBtnRef}
                    type="button"
                    className="ns-button"
                    onClick={() => setAddSelOpen(o => !o)}
                    onKeyDown={onAddSelKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={addSelOpen}
                    aria-controls="difficulty-menu-add"
                  >
                    <span>{diffOptions[addIndex]?.label ?? "Select"}</span>
                    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden className="ns-caret">
                      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {addSelOpen && (
                    <ul
                      id="difficulty-menu-add"
                      ref={addSelListRef}
                      role="listbox"
                      tabIndex={-1}
                      className="ns-menu"
                      onKeyDown={onAddSelKeyDown}
                      aria-activedescendant={`diff-add-opt-${addSelActive}`}
                    >
                      {diffOptions.map((o, i) => {
                        const selected = String(o.value) === String(form.difficulty);
                        const active = i === addSelActive;
                        return (
                          <li
                            id={`diff-add-opt-${i}`}
                            key={o.value}
                            role="option"
                            aria-selected={selected}
                            className={"ns-item" + (active ? " active" : "") + (selected ? " selected" : "")}
                            onMouseEnter={() => setAddSelActive(i)}
                            onClick={() => {
                              setForm({ ...form, difficulty: Number(o.value) });
                              setAddSelOpen(false);
                              addSelBtnRef.current?.focus();
                            }}
                          >
                            {o.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {/* /Custom Select (Add) */}
              </div>

              <div className="field" style={{flex:1}}>
                <label className="label">Target days / week</label>
                <input className="input" type="number" min="1" max="7"
                       value={form.targetDays}
                       onChange={e=>setForm({...form, targetDays:Number(e.target.value)})} />
              </div>
            </div>

            <div className="row" style={{justifyContent:"flex-end", gap:10, marginTop:12}}>
              <button className="btn-ghost" onClick={()=>setOpen(false)}>Cancel</button>
              <button className="btn" onClick={addHabit}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
              <h3 style={{margin:0}}>Edit Habit</h3>
              <button className="btn-ghost" onClick={()=>setEditOpen(false)}>✕</button>
            </div>

            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={editForm.name}
                     onChange={e=>setEditForm({...editForm, name:e.target.value})} />
            </div>
            <div className="field">
              <label className="label">If–Then Plan</label>
              <input className="input" value={editForm.ifThen}
                     onChange={e=>setEditForm({...editForm, ifThen:e.target.value})} />
            </div>
            <div className="field">
              <label className="label">Micro-tasks (comma-separated)</label>
              <input className="input" value={editForm.tasks}
                     onChange={e=>setEditForm({...editForm, tasks:e.target.value})} />
            </div>

            <div className="row" style={{gap:12}}>
              <div className="field" style={{flex:1}}>
                <label className="label">Difficulty</label>

                {/* Custom Select (Edit) */}
                <div className="hf-select">
                  <button
                    ref={editSelBtnRef}
                    type="button"
                    className="ns-button"
                    onClick={() => setEditSelOpen(o => !o)}
                    onKeyDown={onEditSelKeyDown}
                    aria-haspopup="listbox"
                    aria-expanded={editSelOpen}
                    aria-controls="difficulty-menu-edit"
                  >
                    <span>{diffOptions[editIndex]?.label ?? "Select"}</span>
                    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden className="ns-caret">
                      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {editSelOpen && (
                    <ul
                      id="difficulty-menu-edit"
                      ref={editSelListRef}
                      role="listbox"
                      tabIndex={-1}
                      className="ns-menu"
                      onKeyDown={onEditSelKeyDown}
                      aria-activedescendant={`diff-edit-opt-${editSelActive}`}
                    >
                      {diffOptions.map((o, i) => {
                        const selected = String(o.value) === String(editForm.difficulty);
                        const active = i === editSelActive;
                        return (
                          <li
                            id={`diff-edit-opt-${i}`}
                            key={o.value}
                            role="option"
                            aria-selected={selected}
                            className={"ns-item" + (active ? " active" : "") + (selected ? " selected" : "")}
                            onMouseEnter={() => setEditSelActive(i)}
                            onClick={() => {
                              setEditForm({ ...editForm, difficulty: Number(o.value) });
                              setEditSelOpen(false);
                              editSelBtnRef.current?.focus();
                            }}
                          >
                            {o.label}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {/* /Custom Select (Edit) */}
              </div>

              <div className="field" style={{flex:1}}>
                <label className="label">Target days / week</label>
                <input className="input" type="number" min="1" max="7"
                       value={editForm.targetDays}
                       onChange={e=>setEditForm({...editForm, targetDays:Number(e.target.value)})} />
              </div>
            </div>

            <div className="row" style={{justifyContent:"flex-end", gap:10, marginTop:12}}>
              <button className="btn-ghost" onClick={()=>setEditOpen(false)}>Cancel</button>
              <button className="btn" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
