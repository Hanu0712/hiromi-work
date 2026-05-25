import { useState, useEffect, useRef, useCallback } from "react";
import { getSavedPin, initStorage, pullFromCloud } from "./storage";

/* ───────── constants ───────── */
const STEPS = [
  { id: "intro", part: 0, title: "はじめに" },
  { id: "work1", part: 1, title: "ワーク①", subtitle: "できなかったエピソード5つ" },
  { id: "work2", part: 1, title: "ワーク②", subtitle: "行動を止めた要因30個" },
  { id: "work3", part: 1, title: "ワーク③", subtitle: "グループにまとめる" },
  { id: "work4", part: 1, title: "ワーク④", subtitle: "モヤモヤ BEST 3" },
  { id: "work5", part: 2, title: "ワーク⑤", subtitle: "叶えたい目標5つ" },
  { id: "work6", part: 3, title: "ワーク⑥", subtitle: "止まる可能性がある目標" },
  { id: "work7", part: 3, title: "ワーク⑦", subtitle: "モヤモヤへの向き合い方" },
  { id: "work8", part: 4, title: "ワーク⑧", subtitle: "最も達成したい目標" },
];
const PART_TITLES = ["", "自分を足止めする「嫌」を知る", "叶えたい目標を明確にする", "モヤモヤと目標を照らし合わせる", "最も達成したい目標を決める"];
const PC = ["#b8856c", "#c4956e", "#a67858", "#8b5e3c", "#6d4830"];
const emptyData = () => ({
  work1: ["", "", "", "", ""],
  work2: Array(30).fill(""),
  work3: ["", "", "", "", "", ""],
  work4: ["", "", ""],
  work5: ["", "", "", "", ""],
  work6: ["", "", "", ""],
  work7_avoid: "",
  work7_decision: "",
  work8: "",
  memo: "",
});
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (d) => {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
};

/* ───────── PIN gate (top-level) ───────── */
export default function App() {
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getSavedPin();
    if (saved) {
      initStorage(saved);
      pullFromCloud(saved).then(() => setReady(true));
    }
  }, []);

  const handlePin = async () => {
    const pin = pinInput.trim();
    if (pin.length < 4) { setError("4文字以上で入力してください"); return; }
    setSyncing(true);
    setError("");
    initStorage(pin);
    await pullFromCloud(pin);
    setSyncing(false);
    setReady(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("hiromi-pin");
    setReady(false);
    setPinInput("");
  };

  if (!ready) {
    const saved = getSavedPin();
    if (saved) return <Loading />;
    return (
      <div style={S.page}>
        <div style={S.homeInner}>
          <div style={S.homeBrand}>HIROMI METHOD</div>
          <h1 style={S.homeTitle}>思考整理ワーク</h1>
          <p style={S.homeSubtitle}>― 目標達成のための 8つのステップ ―</p>
          <div style={{ ...S.card, marginTop: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#5a3e2b", marginBottom: 12 }}>🔑 同期コードを入力</div>
            <p style={{ fontSize: 12, color: "#6b5d52", lineHeight: 1.7, marginBottom: 16 }}>
              どの端末でも同じデータにアクセスできます。<br />初回は好きなコードを決めてください（4文字以上）。<br />2台目以降は同じコードを入力すればデータが同期されます。
            </p>
            <input
              style={S.compactInput}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="例: hiromi2026"
              onKeyDown={(e) => e.key === "Enter" && handlePin()}
            />
            {error && <p style={{ color: "#c44", fontSize: 12, marginTop: 8 }}>{error}</p>}
            <button style={{ ...S.primaryBtn, width: "100%", marginTop: 12 }} onClick={handlePin} disabled={syncing}>
              {syncing ? "同期中..." : "はじめる"}
            </button>
          </div>
          <p style={S.homeCredit}>行動管理トレーナー　ひろみ</p>
        </div>
      </div>
    );
  }

  return <MainApp onLogout={handleLogout} />;
}

/* ───────── main app ───────── */
function MainApp({ onLogout }) {
  const [view, setView] = useState("loading");
  const [sessions, setSessions] = useState([]);
  const [activeDate, setActiveDate] = useState(null);
  const [detailDate, setDetailDate] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const idx = await window.storage.get("hiromi-sessions-index");
      if (idx) {
        const dates = JSON.parse(idx.value);
        const loaded = [];
        for (const d of dates) {
          try {
            const r = await window.storage.get(`hiromi-session-${d}`);
            if (r) loaded.push(JSON.parse(r.value));
          } catch (e) {}
        }
        loaded.sort((a, b) => b.date.localeCompare(a.date));
        setSessions(loaded);
      }
    } catch (e) {}
    setView("home");
  };

  const saveSession = async (session) => {
    const updated = { ...session, updatedAt: new Date().toISOString() };
    await window.storage.set(`hiromi-session-${session.date}`, JSON.stringify(updated));
    const dates = [...new Set([session.date, ...sessions.map((s) => s.date)])];
    await window.storage.set("hiromi-sessions-index", JSON.stringify(dates));
    setSessions((prev) => {
      const next = prev.filter((s) => s.date !== session.date);
      next.unshift(updated);
      next.sort((a, b) => b.date.localeCompare(a.date));
      return next;
    });
  };

  const startNew = () => {
    const d = today();
    const existing = sessions.find((s) => s.date === d);
    if (existing) {
      setActiveDate(d);
    } else {
      const s = { date: d, data: emptyData(), step: 0, updatedAt: new Date().toISOString() };
      setSessions((prev) => {
        const next = prev.filter((x) => x.date !== d);
        next.unshift(s);
        next.sort((a, b) => b.date.localeCompare(a.date));
        return next;
      });
      setActiveDate(d);
      (async () => {
        await window.storage.set(`hiromi-session-${d}`, JSON.stringify(s));
        const dates = [...new Set([d, ...sessions.map((x) => x.date)])];
        await window.storage.set("hiromi-sessions-index", JSON.stringify(dates));
      })();
    }
    setView("work");
  };

  const resumeSession = (date) => { setActiveDate(date); setView("work"); };
  const viewDetail = (date) => { setDetailDate(date); setView("detail"); };

  const deleteSession = async (date) => {
    if (!confirm(`${fmtDate(date)} の記録を削除しますか？`)) return;
    try { await window.storage.delete(`hiromi-session-${date}`); } catch (e) {}
    const next = sessions.filter((s) => s.date !== date);
    setSessions(next);
    await window.storage.set("hiromi-sessions-index", JSON.stringify(next.map((s) => s.date)));
    if (view === "detail") setView("history");
  };

  if (view === "loading") return <Loading />;
  if (view === "home") return <Home sessions={sessions} onNew={startNew} onResume={resumeSession} onHistory={() => setView("history")} onDashboard={() => setView("dashboard")} onLogout={onLogout} />;
  if (view === "work") {
    const s = sessions.find((x) => x.date === activeDate);
    return <Workbook session={s} onSave={saveSession} onExit={() => { loadAll(); }} />;
  }
  if (view === "history") return <History sessions={sessions} onBack={() => setView("home")} onView={viewDetail} onResume={resumeSession} onDelete={deleteSession} />;
  if (view === "detail") {
    const s = sessions.find((x) => x.date === detailDate);
    return <Detail session={s} onBack={() => setView("history")} />;
  }
  if (view === "dashboard") return <Dashboard sessions={sessions} onBack={() => setView("home")} onView={viewDetail} />;
}

/* ───────── loading ───────── */
function Loading() {
  return <div style={S.centerWrap}><p style={{ color: "#8b5e3c", fontFamily: F }}>読み込み中...</p></div>;
}

/* ───────── home ───────── */
function Home({ sessions, onNew, onResume, onHistory, onDashboard, onLogout }) {
  const todaySession = sessions.find((s) => s.date === today());
  return (
    <div style={S.page}>
      <div style={S.homeInner}>
        <div style={S.homeBrand}>HIROMI METHOD</div>
        <h1 style={S.homeTitle}>思考整理ワーク</h1>
        <p style={S.homeSubtitle}>― 目標達成のための 8つのステップ ―</p>

        <div style={S.homeActions}>
          <button style={S.primaryBtn} onClick={onNew}>
            {todaySession ? `📝 今日のワークを続ける（${fmtDate(today())}）` : "✨ 今日のワークを始める"}
          </button>
          {sessions.length > 0 && (
            <>
              <button style={S.secondaryBtn} onClick={onHistory}>📋 過去の記録一覧（{sessions.length}件）</button>
              {sessions.length >= 2 && <button style={S.secondaryBtn} onClick={onDashboard}>📊 傾向・集計ダッシュボード</button>}
            </>
          )}
        </div>

        {sessions.length > 0 && (
          <div style={S.recentSection}>
            <div style={S.recentTitle}>最近の記録</div>
            {sessions.slice(0, 3).map((s) => (
              <div key={s.date} style={S.recentCard} onClick={() => onResume(s.date)}>
                <div style={S.recentDate}>{fmtDate(s.date)}</div>
                <div style={S.recentMeta}>
                  <span style={S.recentProgress}>進捗 {s.step}/{STEPS.length - 1}</span>
                  {s.data.work8 && <span style={S.recentGoal}>🎯 {s.data.work8.slice(0, 30)}{s.data.work8.length > 30 ? "…" : ""}</span>}
                </div>
                <div style={S.recentBar}><div style={{ ...S.recentBarFill, width: `${(s.step / (STEPS.length - 1)) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        <p style={S.homeCredit}>行動管理トレーナー　ひろみ</p>
        <button style={{ ...S.backBtn, fontSize: 11, color: "#b8856c", marginTop: 16, display: "block", textAlign: "center", width: "100%" }} onClick={onLogout}>🔑 同期コードを変更</button>
      </div>
    </div>
  );
}

/* ───────── workbook ───────── */
function Workbook({ session, onSave, onExit }) {
  const [data, setData] = useState(session?.data || emptyData());
  const [step, setStep] = useState(session?.step || 0);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef(null);
  const timer = useRef(null);

  const doSave = useCallback((d, s) => {
    if (timer.current) clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => {
      await onSave({ ...session, data: d, step: s });
      setSaving(false);
    }, 600);
  }, [session, onSave]);

  const updateField = (k, v) => { const d = { ...data, [k]: v }; setData(d); doSave(d, step); };
  const updateArr = (k, i, v) => { const a = [...data[k]]; a[i] = v; updateField(k, a); };
  const goTo = (s) => { setStep(s); setMenuOpen(false); doSave(data, s); contentRef.current?.scrollTo(0, 0); };

  const progress = (step / (STEPS.length - 1)) * 100;
  const cur = STEPS[step];

  return (
    <div style={S.wbContainer}>
      <header style={S.wbHeader}>
        <div style={S.wbHeaderLeft}>
          <button style={S.iconBtn} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <div>
            <div style={S.wbBrandSub}>HIROMI METHOD</div>
            <div style={S.wbBrandTitle}>{fmtDate(session.date)}</div>
          </div>
        </div>
        <div style={S.wbHeaderRight}>
          {saving ? <span style={S.savingTxt}>保存中…</span> : <span style={S.savedTxt}>✓ 保存済み</span>}
          <button style={S.exitBtn} onClick={onExit}>ホームへ</button>
        </div>
      </header>
      <div style={S.progBar}><div style={{ ...S.progFill, width: `${progress}%` }} /></div>

      {menuOpen && (
        <div style={S.overlay} onClick={() => setMenuOpen(false)}>
          <nav style={S.menu} onClick={(e) => e.stopPropagation()}>
            <div style={S.menuHead}>ワーク一覧</div>
            {STEPS.map((s, i) => (
              <button key={s.id} style={{ ...S.menuItem, ...(i === step ? S.menuItemActive : {}) }} onClick={() => goTo(i)}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PC[s.part], flexShrink: 0 }} />
                <span>{s.title}</span>
                {s.subtitle && <span style={S.menuSub}>{s.subtitle}</span>}
              </button>
            ))}
          </nav>
        </div>
      )}

      <main style={S.wbContent} ref={contentRef}>
        <div style={S.wbInner}>
          {cur.part > 0 && <div style={S.partBadge(cur.part)}>PART {cur.part}　{PART_TITLES[cur.part]}</div>}
          {step === 0 && <IntroPage />}
          {step === 1 && <Work1 data={data.work1} onChange={(i, v) => updateArr("work1", i, v)} />}
          {step === 2 && <Work2 data={data.work2} onChange={(i, v) => updateArr("work2", i, v)} />}
          {step === 3 && <Work3 data={data.work3} onChange={(i, v) => updateArr("work3", i, v)} />}
          {step === 4 && <Work4 data={data.work4} memo={data.memo} onChange={(i, v) => updateArr("work4", i, v)} onMemo={(v) => updateField("memo", v)} />}
          {step === 5 && <Work5 data={data.work5} onChange={(i, v) => updateArr("work5", i, v)} />}
          {step === 6 && <Work6 data={data.work6} onChange={(i, v) => updateArr("work6", i, v)} />}
          {step === 7 && <Work7 a={data.work7_avoid} d={data.work7_decision} onA={(v) => updateField("work7_avoid", v)} onD={(v) => updateField("work7_decision", v)} />}
          {step === 8 && <Work8 value={data.work8} onChange={(v) => updateField("work8", v)} />}
        </div>
      </main>

      <footer style={S.wbFooter}>
        <button style={{ ...S.navBtn, ...(step === 0 ? S.navDisabled : {}) }} onClick={() => step > 0 && goTo(step - 1)} disabled={step === 0}>← 前へ</button>
        <span style={S.stepNum}>{step} / {STEPS.length - 1}</span>
        <button style={{ ...S.navBtn, ...S.navPrimary, ...(step === STEPS.length - 1 ? S.navDisabled : {}) }} onClick={() => step < STEPS.length - 1 && goTo(step + 1)} disabled={step === STEPS.length - 1}>次へ →</button>
      </footer>
    </div>
  );
}

/* ───────── history ───────── */
function History({ sessions, onBack, onView, onResume, onDelete }) {
  return (
    <div style={S.page}>
      <div style={S.subpageInner}>
        <button style={S.backBtn} onClick={onBack}>← ホーム</button>
        <h1 style={S.subpageTitle}>📋 過去の記録一覧</h1>
        <p style={S.subpageDesc}>全 {sessions.length} 回のワーク記録</p>
        {sessions.length === 0 && <p style={{ color: "#9a8578", fontSize: 14, textAlign: "center", marginTop: 40 }}>まだ記録がありません</p>}
        {sessions.map((s) => (
          <div key={s.date} style={S.histCard}>
            <div style={S.histTop}>
              <div>
                <div style={S.histDate}>{fmtDate(s.date)}</div>
                <div style={S.histProgress}>進捗 {s.step}/{STEPS.length - 1} ステップ</div>
              </div>
              <div style={S.histBar}><div style={{ ...S.histBarFill, width: `${(s.step / (STEPS.length - 1)) * 100}%` }} /></div>
            </div>
            {s.data.work4.some((x) => x) && (
              <div style={S.histSection}>
                <div style={S.histLabel}>モヤモヤ BEST 3</div>
                {s.data.work4.map((m, i) => m && <div key={i} style={S.histTag}>{["1位", "2位", "3位"][i]}：{m}</div>)}
              </div>
            )}
            {s.data.work8 && (
              <div style={S.histSection}>
                <div style={S.histLabel}>最も達成したい目標</div>
                <div style={S.histGoal}>🎯 {s.data.work8}</div>
              </div>
            )}
            <div style={S.histActions}>
              <button style={S.histBtn} onClick={() => onView(s.date)}>詳細を見る</button>
              <button style={S.histBtn} onClick={() => onResume(s.date)}>編集する</button>
              <button style={{ ...S.histBtn, color: "#c44" }} onClick={() => onDelete(s.date)}>削除</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── detail (read-only view) ───────── */
function Detail({ session, onBack }) {
  if (!session) return null;
  const d = session.data;
  const sections = [
    { title: "ワーク① できなかったエピソード", items: d.work1 },
    { title: "ワーク② 行動を止めた要因", items: d.work2 },
    { title: "ワーク③ グループ分け", items: d.work3 },
    { title: "ワーク④ モヤモヤ BEST 3", items: d.work4, labels: ["1位", "2位", "3位"] },
    { title: "ワーク⑤ 叶えたい目標", items: d.work5 },
    { title: "ワーク⑥ 止まる可能性がある目標", items: d.work6 },
  ];
  return (
    <div style={S.page}>
      <div style={S.subpageInner}>
        <button style={S.backBtn} onClick={onBack}>← 一覧に戻る</button>
        <h1 style={S.subpageTitle}>{fmtDate(session.date)} の記録</h1>
        {sections.map((sec, si) => {
          const filled = sec.items.filter((x) => x.trim());
          if (!filled.length) return null;
          return (
            <div key={si} style={S.detailSection}>
              <div style={S.detailSectionTitle}>{sec.title}</div>
              {sec.items.map((item, i) => item.trim() && (
                <div key={i} style={S.detailItem}>{sec.labels ? <strong>{sec.labels[i]}：</strong> : <span style={{ color: "#b8856c" }}>{i + 1}. </span>}{item}</div>
              ))}
            </div>
          );
        })}
        {(d.work7_avoid || d.work7_decision) && (
          <div style={S.detailSection}>
            <div style={S.detailSectionTitle}>ワーク⑦ モヤモヤへの向き合い方</div>
            {d.work7_avoid && <div style={S.detailItem}><strong>回避策：</strong>{d.work7_avoid}</div>}
            {d.work7_decision && <div style={S.detailItem}><strong>乗り越える？やめる？：</strong>{d.work7_decision}</div>}
          </div>
        )}
        {d.work8 && (
          <div style={{ ...S.detailSection, border: "2px solid #8b5e3c" }}>
            <div style={S.detailSectionTitle}>ワーク⑧ 最も達成したい目標</div>
            <div style={{ ...S.detailItem, fontSize: 16, fontWeight: 700, color: "#5a3e2b" }}>🎯 {d.work8}</div>
          </div>
        )}
        {d.memo && (
          <div style={S.detailSection}>
            <div style={S.detailSectionTitle}>MEMO</div>
            <div style={S.detailItem}>{d.memo}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── dashboard ───────── */
function Dashboard({ sessions, onBack, onView }) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const moyaHistory = sorted.filter((s) => s.data.work4.some((x) => x)).map((s) => ({ date: s.date, items: s.data.work4 }));
  const goalHistory = sorted.filter((s) => s.data.work8).map((s) => ({ date: s.date, goal: s.data.work8 }));
  const allFactors = sorted.flatMap((s) => s.data.work2.filter((x) => x.trim()));
  const freq = {};
  allFactors.forEach((f) => { const k = f.trim(); if (k) freq[k] = (freq[k] || 0) + 1; });
  const topFactors = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const completionData = sorted.map((s) => {
    const total = STEPS.length - 1;
    return { date: s.date, rate: Math.round((s.step / total) * 100) };
  });

  return (
    <div style={S.page}>
      <div style={S.subpageInner}>
        <button style={S.backBtn} onClick={onBack}>← ホーム</button>
        <h1 style={S.subpageTitle}>📊 傾向・集計ダッシュボード</h1>
        <p style={S.subpageDesc}>全 {sessions.length} 回のワークから分析</p>

        <div style={S.dashCard}>
          <div style={S.dashCardTitle}>完了率の推移</div>
          <div style={S.chartWrap}>
            {completionData.map((c, i) => (
              <div key={i} style={S.barCol}>
                <div style={S.barOuter}>
                  <div style={{ ...S.barInner, height: `${c.rate}%` }} />
                </div>
                <div style={S.barLabel}>{c.date.slice(5)}</div>
                <div style={S.barValue}>{c.rate}%</div>
              </div>
            ))}
          </div>
        </div>

        {moyaHistory.length > 0 && (
          <div style={S.dashCard}>
            <div style={S.dashCardTitle}>モヤモヤ BEST 3 の変化</div>
            <div style={S.timelineWrap}>
              {moyaHistory.map((m, i) => (
                <div key={i} style={S.timelineItem}>
                  <div style={S.timelineDot} />
                  <div style={S.timelineContent}>
                    <div style={S.timelineDate} onClick={() => onView(m.date)}>{fmtDate(m.date)}</div>
                    {m.items.map((item, j) => item && (
                      <div key={j} style={S.timelineTag(j)}>{["1位", "2位", "3位"][j]}：{item}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {moyaHistory.length >= 2 && (() => {
              const first = moyaHistory[0].items;
              const last = moyaHistory[moyaHistory.length - 1].items;
              const changed = first.some((f, i) => f !== last[i]);
              return changed ? (
                <div style={S.insightBox}>
                  💡 モヤモヤの内容が変化しています。自分の課題への気づきが深まっている兆候かもしれません。
                </div>
              ) : (
                <div style={S.insightBox}>
                  📌 モヤモヤの内容が一貫しています。ここが最大のブロッカーと言えそうです。
                </div>
              );
            })()}
          </div>
        )}

        {goalHistory.length > 0 && (
          <div style={S.dashCard}>
            <div style={S.dashCardTitle}>🎯 最も達成したい目標の変化</div>
            {goalHistory.map((g, i) => (
              <div key={i} style={S.goalTimeItem}>
                <div style={S.goalTimeDate}>{fmtDate(g.date)}</div>
                <div style={S.goalTimeText}>{g.goal}</div>
              </div>
            ))}
            {goalHistory.length >= 2 && (() => {
              const first = goalHistory[0].goal;
              const last = goalHistory[goalHistory.length - 1].goal;
              return first === last ? (
                <div style={S.insightBox}>💪 目標がブレていません。一貫した方向性が見えます。</div>
              ) : (
                <div style={S.insightBox}>🔄 目標が変化しています。思考整理を重ねて本当にやりたいことが明確になってきているのかもしれません。</div>
              );
            })()}
          </div>
        )}

        {topFactors.length > 0 && (
          <div style={S.dashCard}>
            <div style={S.dashCardTitle}>よく出てくる行動ブロッカー TOP10</div>
            {topFactors.map(([factor, count], i) => (
              <div key={i} style={S.factorRow}>
                <span style={S.factorRank}>{i + 1}</span>
                <span style={S.factorText}>{factor}</span>
                <span style={S.factorCount}>{count}回</span>
              </div>
            ))}
          </div>
        )}

        <div style={S.dashCard}>
          <div style={S.dashCardTitle}>📈 サマリー</div>
          <div style={S.statGrid}>
            <div style={S.statItem}><div style={S.statNum}>{sessions.length}</div><div style={S.statLabel2}>ワーク回数</div></div>
            <div style={S.statItem}><div style={S.statNum}>{sessions.filter((s) => s.step === STEPS.length - 1).length}</div><div style={S.statLabel2}>完了回数</div></div>
            <div style={S.statItem}><div style={S.statNum}>{allFactors.length}</div><div style={S.statLabel2}>洗い出した要因数</div></div>
            <div style={S.statItem}><div style={S.statNum}>{Object.keys(freq).length}</div><div style={S.statLabel2}>ユニーク要因数</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── work page components ───────── */
function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea style={S.ta} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "ここに入力…"} rows={rows} />;
}

function IntroPage() {
  return (
    <div>
      <h1 style={S.pgTitle}>はじめに</h1>
      <div style={S.card}>
        <p style={S.body}>このワークにたどり着いてくれたあなたへ。</p>
        <p style={S.body}>思考整理は、行動を変えていく上で最初のステップです。ここをすっ飛ばして動き出しても、途中で必ず同じ壁にぶつかり「また未完了」で終わってしまいます。</p>
        <p style={S.body}>だからこそ、まずは自分の思考を整理整頓する時間をとること。</p>
        <p style={S.body}>少し根気のいるワークですが、これを丁寧にやり切った人は必ず変わります。集中できる時間と場所を確保して、ぜひ取り組んでみてください。</p>
      </div>
      <div style={S.card}>
        <div style={S.clTitle}>📌 取り組む前に確認しよう</div>
        {["集中できる時間と静かな場所を確保する", "正解はありません。感じたまま、思ったまま書く", "他の人がどう思うかは関係なし。自分だけの答えを書く", "途中でやめず、最後まで取り組む"].map((t, i) => (
          <div key={i} style={S.clItem}><span style={S.clCheck}>✓</span>{t}</div>
        ))}
      </div>
      <div style={S.flowWrap}>
        <div style={S.flowLabel}>WORK FLOW</div>
        <div style={S.flowGrid}>
          {[1, 2, 3, 4].map((p) => (
            <div key={p} style={S.flowCard(p)}><span style={S.flowPart}>Part {p}</span><span style={S.flowTitle}>{PART_TITLES[p]}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Work1({ data, onChange }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク①</h2>
      <h3 style={S.wSub}>やろうと決めたのにできなかったエピソードを5つ書き出す</h3>
      <p style={S.wDesc}>直近を振り返って、やろうと決めたのにできなかったエピソードを5つ書き出してみましょう。仕事でも、プライベートでも、なんでもOKです。</p>
      {data.map((v, i) => (
        <div key={i} style={S.ig}><label style={S.iLabel}>{i + 1}.</label><TA value={v} onChange={(val) => onChange(i, val)} rows={2} /></div>
      ))}
    </div>
  );
}

function Work2({ data, onChange }) {
  const cnt = data.filter((v) => v.trim()).length;
  return (
    <div>
      <h2 style={S.wTitle}>ワーク②</h2>
      <h3 style={S.wSub}>行動を止めた要因を最低30個書き出す</h3>
      <div style={S.tipCard}><div style={S.tipTitle}>📌 3つのポイント</div><p style={S.tipText}>細かいことは考えず、感覚でOK ／ 些細なことも全部書く ／ モヤモヤした気持ちも、そのまま言葉にする</p></div>
      <div style={S.counter}>{cnt} / 30 個記入済み</div>
      <div style={S.compactList}>
        {data.map((v, i) => (
          <div key={i} style={S.compactRow}>
            <span style={S.compactNum}>{i + 1}.</span>
            <input style={S.compactInput} value={v} onChange={(e) => onChange(i, e.target.value)} placeholder={`要因 ${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Work3({ data, onChange }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク③</h2>
      <h3 style={S.wSub}>かぶっている内容をグループにまとめる</h3>
      <div style={S.exCard}><div style={S.exLabel}>EXAMPLE</div><p style={S.exText}>「時間がない」「スケジュールが合わない」「自分の時間がない」<br />→「時間の余裕がない」グループ</p></div>
      <p style={S.wDesc}>グループ分けができたら、「これが自分の足を止めているな」と強く感じる上位3つを可視化しましょう。</p>
      {data.map((v, i) => (
        <div key={i} style={S.ig}><label style={S.iLabel}>グループ {i + 1}</label><TA value={v} onChange={(val) => onChange(i, val)} rows={2} /></div>
      ))}
    </div>
  );
}

function Work4({ data, memo, onChange, onMemo }) {
  const ranks = ["1位", "2位", "3位"];
  const rc = ["#8b5e3c", "#a67858", "#c4956e"];
  return (
    <div>
      <h2 style={S.wTitle}>ワーク④</h2>
      <h3 style={S.wSub}>わたしの行動を止める「モヤモヤ BEST 3」を決める</h3>
      {data.map((v, i) => (
        <div key={i} style={S.ig}><div style={S.rankBadge(rc[i])}>{ranks[i]}</div><TA value={v} onChange={(val) => onChange(i, val)} rows={2} /></div>
      ))}
      <div style={S.reflCard}><div style={S.reflTitle}>▷ 振り返り</div><p style={S.reflText}>「嫌」がわかってはじめて、対策ができる。対策ができてはじめて、行動が続く。</p></div>
      <div style={S.memoBox}><div style={S.memoTitle}>MEMO（ここまでの気づきを書き出そう）</div><TA value={memo} onChange={onMemo} rows={5} placeholder="気づいたことを自由に…" /></div>
    </div>
  );
}

function Work5({ data, onChange }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク⑤</h2>
      <h3 style={S.wSub}>1年以内に叶えたい目標を5つ書き出す</h3>
      <div style={S.exCard}>
        <div style={S.exLabel}>EXAMPLE</div>
        <p style={S.exText}>✗ NG：100万円稼げるようになる ／ 家族で海外旅行にいく<br />⭕ OK：1年以内に週5・1日8時間の稼働で月商25万円を叶える<br />　　　半年以内に家族4人でスペイン旅行に行く</p>
        <p style={{ ...S.exText, marginTop: 8 }}>自分サイズでOK。「毎朝8時までに白湯を飲む」でも立派な目標です。</p>
      </div>
      {data.map((v, i) => (
        <div key={i} style={S.ig}><label style={S.iLabel}>目標 {i + 1}</label><TA value={v} onChange={(val) => onChange(i, val)} rows={2} /></div>
      ))}
      <div style={S.reflCard}><div style={S.reflTitle}>▷ 振り返り</div><p style={S.reflText}>目標は大きさで選ばなくていい。自分が本当に叶えたいかどうか、それだけが基準です。</p></div>
    </div>
  );
}

function Work6({ data, onChange }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク⑥ <span style={S.impBadge}>超重要</span></h2>
      <h3 style={S.wSub}>モヤモヤで行動が止まる可能性がある目標はどれ？</h3>
      <p style={S.wDesc}>ワーク⑤で書いた目標の中に、ワーク④の「モヤモヤ BEST 3」によって行動が止まる可能性があるものはありますか？</p>
      {data.map((v, i) => (
        <div key={i} style={S.ig}><TA value={v} onChange={(val) => onChange(i, val)} rows={2} /></div>
      ))}
    </div>
  );
}

function Work7({ a, d, onA, onD }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク⑦</h2>
      <h3 style={S.wSub}>モヤモヤへの向き合い方を決める</h3>
      <div style={S.ig}><div style={S.w7Label}>① 回避策</div><p style={S.w7Desc}>どうすれば「モヤモヤを回避」できるか</p><TA value={a} onChange={onA} rows={4} /></div>
      <div style={S.ig}><div style={S.w7Label}>② 乗り越える？ やめる？</div><p style={S.w7Desc}>回避できない場合、そのモヤモヤを乗り越えてまで達成したいか</p><TA value={d} onChange={onD} rows={4} /></div>
      <div style={S.reflCard}>
        <div style={S.reflTitle}>▷ 振り返り</div>
        <p style={S.reflText}>① 回避 — モヤモヤが起きない方法・環境を見つける</p>
        <p style={S.reflText}>② 乗り越える — 嫌でも順序立てて進む</p>
        <p style={S.reflText}>③ やめる — その目標自体を手放す</p>
        <p style={{ ...S.reflText, marginTop: 8, fontStyle: "italic" }}>「やらないことを決める」のも、立派な思考整理です。</p>
      </div>
    </div>
  );
}

function Work8({ value, onChange }) {
  return (
    <div>
      <h2 style={S.wTitle}>ワーク⑧</h2>
      <h3 style={S.wSub}>あなたが今、最も達成したい目標はなんですか？</h3>
      <p style={S.wDesc}>誰かの期待でも、他人の目線でもなく、自分の気持ちを優先して答えてください。</p>
      <div style={S.finalBox}><div style={S.finalLabel}>わたしが今、最も達成したい目標</div><TA value={value} onChange={onChange} rows={6} placeholder="ここに書き出す…" /></div>
      <div style={S.card}>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#5a3e2b", marginBottom: 12 }}>最後に</h3>
        <p style={S.body}>ここまで取り組んでくれて、ありがとうございます。</p>
        <p style={S.body}>今の自分に正直に向き合って、小さなことからひとつずつ叶えていく。それだけで、行動は驚くほど変わります。</p>
        <p style={{ ...S.body, textAlign: "right", marginTop: 16, color: "#8b5e3c" }}>行動管理トレーナー　ひろみ</p>
      </div>
    </div>
  );
}

/* ───────── style constants ───────── */
const F = "'Noto Sans JP','Hiragino Sans',sans-serif";
const S = {
  centerWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#faf6f2" },
  page: { minHeight: "100vh", background: "#faf6f2", fontFamily: F, color: "#3a2e25", overflowY: "auto" },
  homeInner: { maxWidth: 500, margin: "0 auto", padding: "48px 20px" },
  homeBrand: { fontSize: 11, letterSpacing: 3, color: "#b8856c", fontWeight: 600, textAlign: "center" },
  homeTitle: { fontSize: 28, fontWeight: 800, textAlign: "center", color: "#3a2e25", margin: "8px 0 4px" },
  homeSubtitle: { fontSize: 13, color: "#9a8578", textAlign: "center", marginBottom: 32 },
  homeActions: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 },
  primaryBtn: { padding: "14px 20px", borderRadius: 10, border: "none", background: "#8b5e3c", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: F },
  secondaryBtn: { padding: "12px 20px", borderRadius: 10, border: "1.5px solid #d4c4b8", background: "#fff", color: "#5a3e2b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: F },
  recentSection: { marginBottom: 32 },
  recentTitle: { fontSize: 13, fontWeight: 700, color: "#8b5e3c", marginBottom: 12, letterSpacing: 1 },
  recentCard: { background: "#fff", border: "1px solid #e8ddd4", borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: "pointer" },
  recentDate: { fontSize: 14, fontWeight: 700, color: "#5a3e2b" },
  recentMeta: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 },
  recentProgress: { fontSize: 11, color: "#9a8578" },
  recentGoal: { fontSize: 11, color: "#6d4830" },
  recentBar: { height: 3, background: "#e8ddd4", borderRadius: 2, marginTop: 8 },
  recentBarFill: { height: "100%", background: "linear-gradient(90deg,#c4956e,#8b5e3c)", borderRadius: 2, transition: "width 0.3s" },
  homeCredit: { fontSize: 13, color: "#b8856c", textAlign: "center" },

  wbContainer: { display: "flex", flexDirection: "column", height: "100vh", background: "#faf6f2", fontFamily: F, color: "#3a2e25", position: "relative", overflow: "hidden" },
  wbHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fff", borderBottom: "1px solid #e8ddd4", flexShrink: 0, zIndex: 10, gap: 8 },
  wbHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  wbHeaderRight: { display: "flex", alignItems: "center", gap: 10 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#8b5e3c", padding: 4 },
  wbBrandSub: { fontSize: 8, letterSpacing: 2, color: "#b8856c", fontWeight: 600 },
  wbBrandTitle: { fontSize: 13, fontWeight: 700, color: "#5a3e2b" },
  savingTxt: { fontSize: 10, color: "#b8856c" },
  savedTxt: { fontSize: 10, color: "#a0c4a0" },
  exitBtn: { padding: "5px 12px", borderRadius: 6, border: "1px solid #d4c4b8", background: "#fff", color: "#6d4830", fontSize: 11, cursor: "pointer", fontFamily: F, fontWeight: 600 },
  progBar: { height: 3, background: "#e8ddd4", flexShrink: 0 },
  progFill: { height: "100%", background: "linear-gradient(90deg,#c4956e,#8b5e3c)", transition: "width 0.4s", borderRadius: "0 2px 2px 0" },
  overlay: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 100 },
  menu: { position: "absolute", top: 0, left: 0, bottom: 0, width: 280, maxWidth: "80vw", background: "#fff", overflowY: "auto", padding: "16px 0", boxShadow: "4px 0 20px rgba(0,0,0,0.1)" },
  menuHead: { padding: "8px 20px 16px", fontSize: 13, fontWeight: 700, color: "#8b5e3c", letterSpacing: 1 },
  menuItem: { display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#3a2e25", textAlign: "left", flexWrap: "wrap", fontFamily: F },
  menuItemActive: { background: "#f5ebe3", fontWeight: 600 },
  menuSub: { width: "100%", paddingLeft: 18, fontSize: 11, color: "#9a8578", marginTop: 2 },
  wbContent: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" },
  wbInner: { maxWidth: 600, margin: "0 auto", padding: "24px 16px 40px" },
  wbFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", borderTop: "1px solid #e8ddd4", flexShrink: 0 },
  navBtn: { padding: "10px 20px", border: "1px solid #d4c4b8", borderRadius: 8, background: "#fff", color: "#5a3e2b", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: F },
  navPrimary: { background: "#8b5e3c", color: "#fff", border: "1px solid #8b5e3c" },
  navDisabled: { opacity: 0.35, cursor: "default" },
  stepNum: { fontSize: 12, color: "#9a8578" },
  partBadge: (p) => ({ display: "inline-block", padding: "6px 14px", borderRadius: 20, background: PC[p], color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: 1, marginBottom: 16 }),

  pgTitle: { fontSize: 24, fontWeight: 800, color: "#3a2e25", marginBottom: 20, borderLeft: "4px solid #8b5e3c", paddingLeft: 12 },
  card: { background: "#fff", borderRadius: 10, padding: 20, marginBottom: 20, border: "1px solid #e8ddd4" },
  body: { fontSize: 14, lineHeight: 1.9, color: "#4a3d33", marginBottom: 8 },
  clTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#5a3e2b" },
  clItem: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, lineHeight: 1.7, marginBottom: 4, color: "#4a3d33" },
  clCheck: { color: "#8b5e3c", fontWeight: 700, flexShrink: 0 },
  flowWrap: { marginTop: 8 },
  flowLabel: { fontSize: 12, fontWeight: 700, color: "#8b5e3c", letterSpacing: 2, marginBottom: 12 },
  flowGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  flowCard: (p) => ({ background: PC[p], borderRadius: 10, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 4 }),
  flowPart: { fontSize: 10, color: "rgba(255,255,255,0.7)" },
  flowTitle: { fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.4 },
  wTitle: { fontSize: 20, fontWeight: 800, color: "#5a3e2b", marginBottom: 4 },
  wSub: { fontSize: 15, fontWeight: 600, color: "#6d4830", marginBottom: 16, lineHeight: 1.5 },
  wDesc: { fontSize: 13, color: "#6b5d52", lineHeight: 1.8, marginBottom: 20 },
  ig: { marginBottom: 16 },
  iLabel: { fontSize: 12, fontWeight: 700, color: "#8b5e3c", marginBottom: 4, display: "block" },
  ta: { width: "100%", padding: "12px 14px", border: "1.5px solid #ddd0c5", borderRadius: 8, fontSize: 14, lineHeight: 1.7, color: "#3a2e25", background: "#fff", resize: "vertical", outline: "none", fontFamily: F, boxSizing: "border-box" },
  tipCard: { background: "#f5ebe3", borderRadius: 10, padding: 16, marginBottom: 16 },
  tipTitle: { fontSize: 13, fontWeight: 700, color: "#6d4830", marginBottom: 6 },
  tipText: { fontSize: 12, color: "#6b5d52", lineHeight: 1.7 },
  counter: { display: "inline-block", padding: "4px 12px", borderRadius: 12, background: "#8b5e3c", color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 16 },
  compactList: { display: "flex", flexDirection: "column", gap: 6 },
  compactRow: { display: "flex", alignItems: "center", gap: 8 },
  compactNum: { fontSize: 11, fontWeight: 700, color: "#b8856c", minWidth: 24, textAlign: "right" },
  compactInput: { flex: 1, padding: "8px 12px", border: "1.5px solid #ddd0c5", borderRadius: 6, fontSize: 13, color: "#3a2e25", background: "#fff", outline: "none", fontFamily: F },
  exCard: { background: "#f5ebe3", borderRadius: 10, padding: 16, marginBottom: 20, borderLeft: "4px solid #c4956e" },
  exLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#8b5e3c", marginBottom: 6 },
  exText: { fontSize: 12, color: "#6b5d52", lineHeight: 1.8 },
  rankBadge: (bg) => ({ display: "inline-block", padding: "4px 14px", borderRadius: 6, background: bg, color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 8 }),
  reflCard: { background: "#f5ebe3", borderRadius: 10, padding: "16px 20px", marginTop: 20, marginBottom: 16 },
  reflTitle: { fontSize: 13, fontWeight: 700, color: "#6d4830", marginBottom: 8 },
  reflText: { fontSize: 13, color: "#5a4a3e", lineHeight: 1.7, marginBottom: 2 },
  memoBox: { marginTop: 24, padding: 20, border: "2px solid #4a7ab5", borderRadius: 10, background: "#fff" },
  memoTitle: { fontSize: 14, fontWeight: 700, color: "#4a7ab5", textAlign: "center", marginBottom: 12 },
  impBadge: { display: "inline-block", padding: "2px 10px", borderRadius: 4, background: "#c44", color: "#fff", fontSize: 11, fontWeight: 700, marginLeft: 8, verticalAlign: "middle" },
  w7Label: { fontSize: 15, fontWeight: 700, color: "#6d4830", marginBottom: 4, padding: "8px 14px", background: "#f5ebe3", borderRadius: 8 },
  w7Desc: { fontSize: 12, color: "#8b7a6e", marginBottom: 8, marginTop: 6 },
  finalBox: { border: "2px solid #8b5e3c", borderRadius: 12, padding: 20, background: "#fff", marginBottom: 24 },
  finalLabel: { fontSize: 14, fontWeight: 700, color: "#8b5e3c", marginBottom: 12 },

  subpageInner: { maxWidth: 600, margin: "0 auto", padding: "24px 16px 60px" },
  backBtn: { background: "none", border: "none", color: "#8b5e3c", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "4px 0", marginBottom: 16, fontFamily: F },
  subpageTitle: { fontSize: 22, fontWeight: 800, color: "#3a2e25", marginBottom: 4 },
  subpageDesc: { fontSize: 13, color: "#9a8578", marginBottom: 24 },

  histCard: { background: "#fff", border: "1px solid #e8ddd4", borderRadius: 12, padding: 18, marginBottom: 14 },
  histTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 10 },
  histDate: { fontSize: 15, fontWeight: 700, color: "#5a3e2b" },
  histProgress: { fontSize: 11, color: "#9a8578", marginTop: 2 },
  histBar: { width: 80, height: 4, background: "#e8ddd4", borderRadius: 2, flexShrink: 0 },
  histBarFill: { height: "100%", background: "linear-gradient(90deg,#c4956e,#8b5e3c)", borderRadius: 2 },
  histSection: { marginTop: 10 },
  histLabel: { fontSize: 11, fontWeight: 700, color: "#b8856c", marginBottom: 4 },
  histTag: { fontSize: 12, color: "#5a4a3e", lineHeight: 1.6, paddingLeft: 8 },
  histGoal: { fontSize: 13, color: "#5a3e2b", fontWeight: 600 },
  histActions: { display: "flex", gap: 8, marginTop: 12 },
  histBtn: { padding: "6px 14px", borderRadius: 6, border: "1px solid #d4c4b8", background: "#fff", color: "#6d4830", fontSize: 12, cursor: "pointer", fontFamily: F, fontWeight: 600 },

  detailSection: { background: "#fff", border: "1px solid #e8ddd4", borderRadius: 10, padding: 18, marginBottom: 14 },
  detailSectionTitle: { fontSize: 14, fontWeight: 700, color: "#8b5e3c", marginBottom: 10 },
  detailItem: { fontSize: 13, color: "#4a3d33", lineHeight: 1.8, marginBottom: 4 },

  dashCard: { background: "#fff", border: "1px solid #e8ddd4", borderRadius: 12, padding: 20, marginBottom: 18 },
  dashCardTitle: { fontSize: 15, fontWeight: 700, color: "#5a3e2b", marginBottom: 14 },
  chartWrap: { display: "flex", gap: 6, alignItems: "flex-end", overflowX: "auto", paddingBottom: 8, minHeight: 140 },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36, flex: 1 },
  barOuter: { width: 20, height: 100, background: "#f0e6dc", borderRadius: 4, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" },
  barInner: { background: "linear-gradient(0deg,#8b5e3c,#c4956e)", borderRadius: "4px 4px 0 0", transition: "height 0.5s ease" },
  barLabel: { fontSize: 9, color: "#9a8578", marginTop: 4 },
  barValue: { fontSize: 10, fontWeight: 700, color: "#6d4830" },
  timelineWrap: { position: "relative", paddingLeft: 20 },
  timelineItem: { display: "flex", gap: 14, marginBottom: 18, position: "relative" },
  timelineDot: { width: 10, height: 10, borderRadius: "50%", background: "#8b5e3c", flexShrink: 0, marginTop: 4, position: "relative", zIndex: 1 },
  timelineContent: { flex: 1 },
  timelineDate: { fontSize: 13, fontWeight: 700, color: "#5a3e2b", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#d4c4b8" },
  timelineTag: (i) => ({ fontSize: 12, color: ["#8b5e3c", "#a67858", "#c4956e"][i], lineHeight: 1.6, paddingLeft: 4 }),
  insightBox: { background: "#f5ebe3", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#5a3e2b", lineHeight: 1.7, marginTop: 12 },
  goalTimeItem: { display: "flex", gap: 14, alignItems: "baseline", marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #f0e6dc" },
  goalTimeDate: { fontSize: 12, fontWeight: 700, color: "#b8856c", minWidth: 90, flexShrink: 0 },
  goalTimeText: { fontSize: 13, color: "#4a3d33", lineHeight: 1.6 },
  factorRow: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #f5ebe3" },
  factorRank: { width: 22, height: 22, borderRadius: "50%", background: "#8b5e3c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  factorText: { flex: 1, fontSize: 13, color: "#4a3d33" },
  factorCount: { fontSize: 12, fontWeight: 700, color: "#b8856c" },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  statItem: { background: "#faf6f2", borderRadius: 10, padding: 16, textAlign: "center" },
  statNum: { fontSize: 28, fontWeight: 800, color: "#8b5e3c" },
  statLabel2: { fontSize: 11, color: "#9a8578", marginTop: 4 },
};
