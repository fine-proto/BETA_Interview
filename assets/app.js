(function () {
  "use strict";

  var IV = window.INTERVIEWS || [];
  var OV = window.OVERVIEW || {};
  var FEATURES = window.FEATURES || [];
  var BASE = window.BASELINE_KEYS || [];
  var TRANSCRIPTS = {};
  var main = document.getElementById("main");

  var SENTI = { pos: "긍정", mix: "조건부", neu: "중립", neg: "부정", na: "미확인" };
  var DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var MOD = "진행자";

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, ""); }
  function fmtDate(d, t) {
    if (!d) return "";
    var p = d.split("-"), dt = new Date(+p[0], +p[1] - 1, +p[2]);
    var s = p[0] + "." + p[1] + "." + p[2] + " (" + DAYS[dt.getDay()] + ")";
    return t ? s + " " + t : s;
  }
  function byId(id) { for (var i = 0; i < IV.length; i++) if (IV[i].id === id) return IV[i]; return null; }
  function sorted() {
    return IV.slice().sort(function (a, b) {
      var ka = a.date + " " + (a.time || "99:99") + a.id, kb = b.date + " " + (b.time || "99:99") + b.id;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }
  function typeBadge(iv) {
    return iv.type === "리허설"
      ? '<span class="badge rehearsal">리허설</span>'
      : '<span class="badge main-iv">' + esc(iv.type || "본 인터뷰") + "</span>";
  }
  function senti(k) { k = k || "na"; return '<span class="senti ' + k + '">' + SENTI[k] + "</span>"; }
  function featOf(iv, key) {
    var f = iv.features || [];
    for (var i = 0; i < f.length; i++) if (f[i].key === key) return f[i];
    return null;
  }
  function featName(key) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].key === key) return FEATURES[i].name;
    return key;
  }
  function featAliases(key) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].key === key) return [FEATURES[i].name].concat(FEATURES[i].aliases || []);
    return [];
  }
  function featCore(key) {
    for (var i = 0; i < FEATURES.length; i++) if (FEATURES[i].key === key) return [FEATURES[i].name].concat(FEATURES[i].core || []);
    return [];
  }
  function quoteObj(q) { return typeof q === "string" ? { text: q } : q; }
  function trLink(id, at, hl) {
    var qs = [];
    if (at) qs.push("at=" + encodeURIComponent(at));
    if (hl) qs.push("hl=" + encodeURIComponent(hl));
    return "#/i/" + encodeURIComponent(id) + "/transcript" + (qs.length ? "?" + qs.join("&") : "");
  }
  // highlight terms (space-insensitive) in already-escaped-safe way
  function hlText(text, terms, maxLen) {
    var raw = String(text || "");
    var pats = (terms || []).filter(function (t) { return t && t.replace(/\s/g, "").length >= 1; })
      .map(function (t) { return t.replace(/\s+/g, "").split("").map(reEsc).join("\\s*"); });
    var re = pats.length ? new RegExp("(" + pats.join("|") + ")", "gi") : null;
    if (maxLen && raw.length > maxLen) {
      var m = re ? re.exec(raw) : null, pos = m ? m.index : 0;
      if (re) re.lastIndex = 0;
      var start = Math.max(0, pos - Math.floor(maxLen / 3));
      raw = (start > 0 ? "…" : "") + raw.slice(start, start + maxLen) + (start + maxLen < raw.length ? "…" : "");
    }
    if (!re) return esc(raw);
    var out = "", last = 0, mm;
    re.lastIndex = 0;
    while ((mm = re.exec(raw))) {
      if (!mm[0]) { re.lastIndex++; continue; }
      out += esc(raw.slice(last, mm.index)) + "<mark>" + esc(mm[0]) + "</mark>";
      last = mm.index + mm[0].length;
    }
    return out + esc(raw.slice(last));
  }

  // ---------- transcripts ----------
  window.__registerTranscript = function (id, turns) { TRANSCRIPTS[id] = turns; };
  function loadTranscript(id, cb) {
    if (TRANSCRIPTS[id]) return cb(TRANSCRIPTS[id]);
    var s = document.createElement("script");
    s.src = "data/transcripts/" + encodeURIComponent(id) + ".js?v=" + (OV.updated || "");
    s.onload = function () { cb(TRANSCRIPTS[id] || null); };
    s.onerror = function () { cb(null); };
    document.body.appendChild(s);
  }
  function loadAllTranscripts(cb) {
    var left = IV.length;
    if (!left) return cb();
    IV.forEach(function (iv) { loadTranscript(iv.id, function () { if (--left === 0) cb(); }); });
  }
  function findTurn(turns, phrase) {
    if (!turns || !phrase) return -1;
    var n = norm(phrase);
    for (var i = 0; i < turns.length; i++) if (norm(turns[i].x).indexOf(n) >= 0) return i;
    return -1;
  }
  function prevModTurn(turns, i) {
    for (var k = i - 1; k >= 0 && k >= i - 4; k--) if (turns[k].s === MOD) return turns[k];
    return null;
  }

  // ---------- sidebar ----------
  function renderNav(activeId, overviewActive) {
    var list = sorted(), html = "", lastDate = null;
    list.forEach(function (iv) {
      if (iv.date !== lastDate) {
        html += '<div class="nav-date">' + esc(fmtDate(iv.date)) + "</div>";
        lastDate = iv.date;
      }
      html += '<a class="nav-item' + (iv.id === activeId ? " active" : "") + '" href="#/i/' + esc(iv.id) + '">' +
        '<div class="nav-item-top"><span class="nav-name">' + esc(iv.name) + "</span>" + typeBadge(iv) + "</div>" +
        '<div class="nav-meta">' + esc(fmtDate(iv.date, iv.time)) + (iv.duration ? " · " + esc(iv.duration) : "") + "</div>" +
        (iv.persona ? '<div class="nav-meta">' + esc(iv.persona) + "</div>" : "") +
        "</a>";
    });
    document.getElementById("navList").innerHTML = html || '<div class="nav-meta" style="padding:0 12px">아직 인터뷰가 없습니다.</div>';
    document.getElementById("navCount").textContent = "(" + IV.length + ")";
    document.getElementById("navOverview").classList.toggle("active", !!overviewActive);
  }

  // ---------- overview ----------
  function renderOverview() {
    var list = sorted();
    var mainCount = list.filter(function (i) { return i.type !== "리허설"; }).length;
    var dates = list.map(function (i) { return i.date; });
    var period = dates.length ? fmtDate(dates[0]).slice(0, 10) + (dates[0] !== dates[dates.length - 1] ? " ~ " + fmtDate(dates[dates.length - 1]).slice(5, 10) : "") : "-";
    var mins = list.map(function (i) { var m = /(\d+)/.exec(i.duration || ""); return m ? +m[1] : null; }).filter(function (x) { return x; });
    var avg = mins.length ? Math.round(mins.reduce(function (a, b) { return a + b; }, 0) / mins.length) : null;

    var h = "";
    h += '<section class="card hero"><div class="eyebrow">전체 요약 분석</div>' +
      "<h1>사전 인터뷰 종합</h1>" +
      '<p class="lead">' + esc(OV.summary || "") + "</p>" +
      (OV.scope ? '<div class="note">' + esc(OV.scope) + "</div>" : "") + "</section>";

    h += '<div class="stats">' +
      stat("인터뷰", IV.length + "명", "본 인터뷰 " + mainCount + " · 리허설 " + (IV.length - mainCount)) +
      stat("진행 기간", period, (new Set(dates)).size + "일") +
      stat("평균 소요", avg ? "약 " + avg + "분" : "-", "1:1 대면") +
      stat("마지막 반영", OV.updated ? fmtDate(OV.updated).slice(0, 10) : "-", "요약·분석 기준일") +
      "</div>";

    if (OV.findings && OV.findings.length) {
      h += '<section class="section"><h2>핵심 발견</h2><div class="findings">';
      OV.findings.forEach(function (f, i) {
        h += '<div class="finding"><div class="finding-no">' + String(i + 1).padStart(2, "0") + "</div>" +
          "<h3>" + esc(f.title) + "</h3><p>" + esc(f.body) + "</p>" +
          (f.evidence ? '<div class="ev">근거: ' + esc(f.evidence) + "</div>" : "") + "</div>";
      });
      h += "</div></section>";
    }

    h += '<section class="section"><h2>기능별 반응 <span class="sub">인터뷰 데이터에서 자동 집계</span></h2>' +
      '<div class="legend">' + ["pos", "mix", "neu", "neg", "na"].map(senti).join("") + "</div>" +
      '<div class="table-wrap"><table class="matrix"><thead><tr><th class="rowhead">기능</th>';
    list.forEach(function (iv) {
      h += '<th class="col"><a href="#/i/' + esc(iv.id) + '">' + esc(iv.name) + '</a><div class="muted" style="font-weight:500">' + esc(iv.type) + "</div></th>";
    });
    h += "<th>분포</th></tr></thead><tbody>";
    FEATURES.forEach(function (F) {
      var cnt = { pos: 0, mix: 0, neu: 0, neg: 0 }, total = 0;
      h += '<tr><td class="rowhead">' + esc(F.name) + "</td>";
      list.forEach(function (iv) {
        var f = featOf(iv, F.key), k = f ? f.sentiment : "na";
        if (cnt[k] != null) { cnt[k]++; total++; }
        h += '<td title="' + esc(f ? f.reaction : "") + '">' + senti(k) + "</td>";
      });
      h += '<td><div class="dist">';
      ["pos", "mix", "neu", "neg"].forEach(function (k) {
        if (cnt[k]) h += '<span class="' + k + '" style="width:' + (cnt[k] / total * 100) + '%"></span>';
      });
      h += "</div></td></tr>";
    });
    h += '</tbody></table></div><p class="muted" style="font-size:12px;margin:8px 2px 0">칸에 마우스를 올리면 해당 테스터의 반응 요약이 보입니다.</p></section>';

    if (OV.userTypes && OV.userTypes.length) {
      h += '<section class="section"><h2>사용자 유형 <span class="sub">잠정 분류</span></h2><div class="types">';
      OV.userTypes.forEach(function (t) {
        h += '<div class="type"><h3>' + esc(t.name) + "</h3><p>" + esc(t.desc) + "</p>" +
          (t.needs ? '<div class="needs"><b>필요한 것</b> · ' + esc(t.needs) + "</div>" : "") +
          '<div class="members">' + (t.members || []).map(function (id) {
            var iv = byId(id); return iv ? '<a class="member" href="#/i/' + esc(id) + '">' + esc(iv.name) + "</a>" : "";
          }).join("") + "</div></div>";
      });
      h += "</div></section>";
    }

    h += '<section class="section two-col">';
    h += '<div class="card"><h2>기획 반영 후보</h2><ol class="list">' + (OV.opportunities || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>";
    h += '<div class="card"><h2>베타테스트에서 확인할 것</h2><ol class="list">' + (OV.betaChecks || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>";
    h += "</section>";

    h += '<section class="section"><h2>사전 사용자 경험 기준선 (Baseline) <span class="sub">베타 결과와 비교할 고정 항목</span></h2>' +
      '<div class="table-wrap"><table><thead><tr><th class="rowhead">항목</th>';
    list.forEach(function (iv) { h += "<th>" + esc(iv.name) + "</th>"; });
    h += "</tr></thead><tbody>";
    BASE.forEach(function (b) {
      h += '<tr><td class="rowhead">' + esc(b.name) + "</td>";
      list.forEach(function (iv) {
        var v = (iv.baseline || {})[b.key];
        h += "<td>" + (v ? esc(v) : '<span class="muted">미확인</span>') + "</td>";
      });
      h += "</tr>";
    });
    h += "</tbody></table></div></section>";

    main.innerHTML = h;
  }
  function stat(label, value, sub) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + esc(value) +
      '</div><div class="stat-sub">' + esc(sub || "") + "</div></div>";
  }

  // ---------- interview detail ----------
  var VERDICT_FIELDS = [["substitute", "대체 가능 여부"], ["retention", "계속 쓸 조건"], ["privacy", "위치·주행 기록 수집"], ["change", "써본 뒤 인상"], ["questions", "테스터가 궁금해한 점"]];
  var PROFILE_PREVIEW = 4;

  function sentiStrip(iv) {
    return FEATURES.map(function (F) {
      var f = featOf(iv, F.key), k = f ? f.sentiment : "na";
      return '<span class="strip-item ' + k + '" title="' + esc(SENTI[k] + (f ? " · " + f.reaction : "")) + '"><i></i>' + esc(F.name) + "</span>";
    }).join("");
  }

  function renderInterview(iv) {
    var v = iv.verdict || {};
    var h = "";

    // 1. 한눈에 보기
    h += '<section class="card hero"><div class="detail-head"><div>' +
      '<div class="eyebrow">인터뷰 요약</div>' +
      "<h1>" + esc(iv.name) + " " + typeBadge(iv) + "</h1>" +
      '<div class="meta-row"><span><b>일시</b> ' + esc(fmtDate(iv.date, iv.time)) + "</span>" +
      (iv.duration ? "<span><b>소요</b> " + esc(iv.duration) + "</span>" : "") +
      (iv.source ? "<span><b>구분</b> " + esc(iv.source) + "</span>" : "") +
      (iv.persona ? "<span><b>유형</b> " + esc(iv.persona) + "</span>" : "") + "</div></div>" +
      '<div class="head-actions"><a class="btn primary" href="' + trLink(iv.id) + '">원문 보기 →</a>' +
      '<details class="dl-menu"><summary class="btn">⤓ 내려받기</summary><div class="dl-pop">' +
      '<button type="button" data-dl="summary">요약 (Word)</button>' +
      '<button type="button" data-dl="full">요약 + 원문 (Word)</button></div></details></div></div>' +
      (iv.headline ? '<p class="headline">' + esc(iv.headline) + "</p>" : "") +
      ((iv.tags || []).length ? '<div style="margin-top:12px">' + iv.tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      (iv.caveat ? '<div class="note">' + esc(iv.caveat) + "</div>" : "");
    if ((v.good || []).length || (v.bad || []).length) {
      h += '<div class="glance">' +
        '<div><div class="glance-label">좋았던 기능</div>' + ((v.good || []).map(function (x) { return '<span class="chip-good">' + esc(x) + "</span>"; }).join("") || '<span class="muted">-</span>') + "</div>" +
        '<div><div class="glance-label">쓰지 않을 기능</div>' + ((v.bad || []).map(function (x) { return '<span class="chip-bad">' + esc(x) + "</span>"; }).join("") || '<span class="muted">-</span>') + "</div></div>";
    }
    h += '<div class="glance-label" style="margin-top:14px">기능별 반응</div><div class="strip">' + sentiStrip(iv) + "</div>";
    h += "</section>";

    // section nav
    var secs = [["sec-insight", "핵심 인사이트", (iv.insights || []).length], ["sec-quote", "인상적인 발언", (iv.quotes || []).length],
      ["sec-feature", "기능별 반응", (iv.features || []).length], ["sec-verdict", "종합 평가", VERDICT_FIELDS.some(function (p) { return v[p[0]]; })],
      ["sec-profile", "프로필", (iv.profile || []).length], ["sec-baseline", "기준선", !!iv.baseline]];
    h += '<nav class="secnav">' + secs.filter(function (s) { return s[2]; }).map(function (s) {
      return '<button type="button" data-go="' + s[0] + '">' + s[1] + "</button>";
    }).join("") + "</nav>";

    // 2. 핵심 인사이트
    if ((iv.insights || []).length) {
      h += '<section class="section" id="sec-insight"><h2>핵심 인사이트</h2><div class="card"><ol class="list">' +
        iv.insights.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div></section>";
    }

    // 3. 인상적인 발언
    if ((iv.quotes || []).length) {
      h += '<section class="section" id="sec-quote"><h2>인상적인 발언 <span class="sub">마우스를 올리면 원문 맥락이 보입니다</span></h2><div class="quotes">';
      iv.quotes.forEach(function (q, i) {
        q = quoteObj(q);
        h += '<div class="quote" tabindex="0" data-qi="' + i + '">' +
          (q.topic ? '<div class="quote-topic">' + esc(q.topic) + "</div>" : "") +
          '<div class="quote-text">“' + esc(q.text) + "”</div>" +
          '<div class="quote-pop" id="qpop-' + i + '"><div class="loading" style="padding:8px">원문 불러오는 중…</div></div>' +
          "</div>";
      });
      h += "</div></section>";
    }

    // 4. 기능별 반응
    if ((iv.features || []).length) {
      h += '<section class="section" id="sec-feature"><h2>기능별 반응</h2><div class="table-wrap"><table class="feat-table"><thead><tr>' +
        "<th>기능</th><th>반응</th><th>핵심 반응</th><th>제안</th></tr></thead><tbody>";
      FEATURES.forEach(function (F) {
        var f = featOf(iv, F.key);
        if (!f) return;
        h += '<tr><td class="rowhead">' + esc(F.name) + (f.expect ? '<span class="exp">기대: ' + esc(f.expect) + "</span>" : "") + "</td>" +
          "<td>" + senti(f.sentiment) + "</td><td>" + esc(f.reaction) + '</td><td class="sugg">' + esc(f.suggestion || "") + "</td></tr>";
      });
      iv.features.forEach(function (f) {
        if (FEATURES.some(function (F) { return F.key === f.key; })) return;
        h += '<tr><td class="rowhead">' + esc(f.name || f.key) + "</td><td>" + senti(f.sentiment) + "</td><td>" + esc(f.reaction) + '</td><td class="sugg">' + esc(f.suggestion || "") + "</td></tr>";
      });
      h += "</tbody></table></div></section>";
    }

    // 5. 종합 평가
    var vItems = VERDICT_FIELDS.filter(function (p) { return v[p[0]]; })
      .map(function (p) { return '<div class="card"><h3>' + p[1] + "</h3><p>" + esc(v[p[0]]) + "</p></div>"; });
    if (vItems.length) h += '<section class="section" id="sec-verdict"><h2>종합 평가</h2><div class="verdict">' + vItems.join("") + "</div></section>";

    // 6. 프로필 (접기)
    if ((iv.profile || []).length) {
      var more = iv.profile.length > PROFILE_PREVIEW;
      h += '<section class="section" id="sec-profile"><h2>테스터 프로필</h2><div class="card profile-card' + (more ? " collapsed" : "") + '"><dl class="profile">';
      iv.profile.forEach(function (p, i) {
        var cls = i >= PROFILE_PREVIEW ? ' class="extra"' : "";
        h += "<dt" + cls + ">" + esc(p.label) + "</dt><dd" + cls + ">" + esc(p.text) + "</dd>";
      });
      h += "</dl>" + (more ? '<button type="button" class="more-btn" data-more>프로필 전체 보기 (' + iv.profile.length + "개 항목) ▾</button>" : "") + "</div></section>";
    }

    // 7. 기준선 (접기)
    if (iv.baseline) {
      h += '<section class="section" id="sec-baseline"><details class="fold"><summary><h2>기준선 (Baseline) <span class="sub">베타 결과와 비교할 항목 · 눌러서 펼치기</span></h2></summary><div class="card"><dl class="profile">';
      BASE.forEach(function (b) {
        var val = iv.baseline[b.key];
        h += "<dt>" + esc(b.name) + "</dt><dd>" + (val ? esc(val) : '<span class="muted">미확인</span>') + "</dd>";
      });
      h += "</dl></div></details></section>";
    }

    h += '<section class="section"><a class="btn" href="' + trLink(iv.id) + '">원문 전체 보기 →</a></section>';
    main.innerHTML = h;

    // interactions
    Array.prototype.forEach.call(main.querySelectorAll(".secnav button"), function (b) {
      b.addEventListener("click", function () {
        var el = document.getElementById(b.getAttribute("data-go"));
        if (!el) return;
        var d = el.querySelector("details"); if (d) d.open = true;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
      });
    });
    var mb = main.querySelector("[data-more]");
    if (mb) mb.addEventListener("click", function () {
      var c = main.querySelector(".profile-card"), open = c.classList.toggle("collapsed") === false;
      mb.textContent = open ? "접기 ▴" : "프로필 전체 보기 (" + iv.profile.length + "개 항목) ▾";
    });
    Array.prototype.forEach.call(main.querySelectorAll("[data-dl]"), function (b) {
      b.addEventListener("click", function () {
        var menu = main.querySelector(".dl-menu"); if (menu) menu.open = false;
        downloadDocx(iv, b.getAttribute("data-dl") === "full");
      });
    });

    if ((iv.quotes || []).length) {
      loadTranscript(iv.id, function (turns) {
        iv.quotes.forEach(function (q, i) {
          q = quoteObj(q);
          var pop = document.getElementById("qpop-" + i);
          if (!pop) return;
          var idx = findTurn(turns, q.find || q.text);
          if (idx < 0) { pop.innerHTML = '<div class="muted" style="font-size:13px">원문에서 해당 부분을 찾지 못했습니다.</div>'; return; }
          var t = turns[idx], prev = prevModTurn(turns, idx);
          pop.innerHTML =
            (prev ? '<div class="pop-turn mod"><b>진행자</b> <span class="turn-time">' + esc(prev.t) + "</span><p>" + hlText(prev.x, [], 160) + "</p></div>" : "") +
            '<div class="pop-turn"><b>' + esc(t.s) + '</b> <span class="turn-time">' + esc(t.t) + "</span><p>" + hlText(t.x, [q.find || ""], 260) + "</p></div>" +
            '<a class="pop-link" href="' + trLink(iv.id, t.t, q.find) + '">원문에서 보기 →</a>';
        });
      });
    }
  }

  // ---------- Word 내려받기 ----------
  function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n) + "…" : s; }
  var SENTI_COLOR = { pos: "12805C", mix: "B26A00", neu: "5B6478", neg: "C4322B", na: "A3AAB8" };

  function downloadDocx(iv, withTranscript) {
    if (!window.MiniDocx) { alert("내려받기 모듈을 불러오지 못했습니다."); return; }
    loadTranscript(iv.id, function (turns) {
      var v = iv.verdict || {}, B = [];
      B.push({ t: "title", text: iv.name + " 인터뷰 요약" });
      B.push({ t: "small", text: [fmtDate(iv.date, iv.time), iv.duration, iv.type + (iv.source ? " · " + iv.source : ""), iv.persona ? "유형: " + iv.persona : ""].filter(Boolean).join("  |  ") });
      if (iv.headline) B.push({ t: "p", runs: [{ text: iv.headline, b: true }] });
      if ((iv.tags || []).length) B.push({ t: "small", text: "키워드: " + iv.tags.join(", ") });
      if (iv.caveat) B.push({ t: "small", text: "※ " + iv.caveat });

      B.push({ t: "h1", text: "한눈에 보기" });
      B.push({ t: "table", widths: [1, 3], rows: [
        [{ runs: "좋았던 기능", base: { b: true }, fill: "F6F7F9" }, { runs: [{ text: (v.good || []).join(", ") || "-", color: "12805C" }] }],
        [{ runs: "쓰지 않을 기능", base: { b: true }, fill: "F6F7F9" }, { runs: [{ text: (v.bad || []).join(", ") || "-", color: "C4322B" }] }],
        [{ runs: "기능별 반응", base: { b: true }, fill: "F6F7F9" }, { runs: FEATURES.map(function (F, i) {
          var f = featOf(iv, F.key), k = f ? f.sentiment : "na";
          return { text: (i ? "   " : "") + F.name + " " + SENTI[k], color: SENTI_COLOR[k] };
        }) }]
      ] });

      if ((iv.insights || []).length) {
        B.push({ t: "h1", text: "핵심 인사이트" });
        iv.insights.forEach(function (x) { B.push({ t: "bullet", text: x }); });
      }

      if ((iv.quotes || []).length) {
        B.push({ t: "h1", text: "인상적인 발언" });
        iv.quotes.forEach(function (q) {
          q = quoteObj(q);
          if (q.topic) B.push({ t: "h2", text: q.topic });
          B.push({ t: "quote", text: "“" + q.text + "”" });
          var idx = findTurn(turns, q.find || q.text);
          if (idx >= 0) {
            var t = turns[idx], prev = prevModTurn(turns, idx);
            var ctx = [];
            if (prev) ctx.push({ text: "진행자 (" + prev.t + "): ", b: true }, { text: clip(prev.x, 160) + "\n" });
            ctx.push({ text: t.s + " (" + t.t + "): ", b: true }, { text: clip(t.x, 320) });
            B.push({ t: "small", runs: ctx });
          }
        });
      }

      if ((iv.features || []).length) {
        B.push({ t: "h1", text: "기능별 반응" });
        var rows = [["기능", "반응", "기대", "핵심 반응", "제안"]];
        FEATURES.forEach(function (F) {
          var f = featOf(iv, F.key); if (!f) return;
          rows.push([{ runs: F.name, base: { b: true } }, { runs: [{ text: SENTI[f.sentiment || "na"], b: true, color: SENTI_COLOR[f.sentiment || "na"] }] },
            f.expect || "", f.reaction || "", { runs: [{ text: f.suggestion || "", color: "1F4FD8" }] }]);
        });
        B.push({ t: "table", header: true, widths: [1.5, 0.8, 1.6, 3.4, 2.7], rows: rows });
      }

      var vf = VERDICT_FIELDS.filter(function (p) { return v[p[0]]; });
      if (vf.length) {
        B.push({ t: "h1", text: "종합 평가" });
        B.push({ t: "table", widths: [1, 3], rows: vf.map(function (p) { return [{ runs: p[1], base: { b: true }, fill: "F6F7F9" }, v[p[0]]]; }) });
      }

      if ((iv.profile || []).length) {
        B.push({ t: "h1", text: "테스터 프로필" });
        B.push({ t: "table", widths: [1, 3.5], rows: iv.profile.map(function (p) { return [{ runs: p.label, base: { b: true }, fill: "F6F7F9" }, p.text]; }) });
      }

      if (iv.baseline) {
        B.push({ t: "h1", text: "기준선 (Baseline)" });
        B.push({ t: "table", widths: [1.3, 3], rows: BASE.map(function (b) { return [{ runs: b.name, base: { b: true }, fill: "F6F7F9" }, iv.baseline[b.key] || "미확인"]; }) });
      }

      if (withTranscript && turns) {
        B.push({ t: "pagebreak" });
        B.push({ t: "h1", text: "부록 · 인터뷰 원문" });
        B.push({ t: "small", text: "녹취 자동 변환본입니다. 인식 오류가 있을 수 있고, 진행자는 '진행자', 그 외 실명은 성+OO로 표기했습니다." });
        turns.forEach(function (t) {
          B.push({ t: "p", runs: [{ text: (t.s || "-") + "  ", b: true, color: t.s === MOD ? "667085" : "1F4FD8" }, { text: t.t, color: "98A2B3", size: 17 }, { text: "\n" + t.x, color: t.s === MOD ? "4A5468" : "1D2433" }] });
        });
      }

      B.push({ t: "small", text: "FINE Alaseo 베타테스트 사전 인터뷰 · 비식별 처리본 · 내려받은 날 " + new Date().toISOString().slice(0, 10) });

      var blob = window.MiniDocx.build(B);
      var fname = "FINE_Alaseo_사전인터뷰_" + iv.date.replace(/-/g, "") + "_" + iv.name.replace(/[\\/:*?"<>|()\s]/g, "") + (withTranscript ? "_요약+원문" : "_요약") + ".docx";
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  // ---------- transcript ----------
  function roleOf(name, iv) {
    if (name === MOD) return "mod";
    if (name === iv.name || name === iv.speaker) return "tester";
    return "other";
  }

  function renderTranscript(iv, params) {
    var at = params.at || "", hl = params.hl || "";
    main.innerHTML =
      '<section class="card hero"><div class="detail-head"><div>' +
      '<div class="eyebrow">인터뷰 원문</div><h1>' + esc(iv.name) + " " + typeBadge(iv) + "</h1>" +
      '<div class="meta-row"><span><b>일시</b> ' + esc(fmtDate(iv.date, iv.time)) + "</span>" +
      (iv.duration ? "<span><b>소요</b> " + esc(iv.duration) + "</span>" : "") + "</div>" +
      '<p class="muted" style="margin:0;font-size:13px">녹취 자동 변환본입니다. 인식 오류가 있을 수 있고, 진행자는 \'진행자\', 그 외 실명은 성+OO로 표기했습니다.</p></div>' +
      '<a class="btn" href="#/i/' + esc(iv.id) + '">← 요약으로</a></div></section>' +
      '<div class="tr-toolbar"><input class="tr-search" id="trSearch" type="search" placeholder="이 원문에서 검색 (예: 문콕, 과실, 가치봄)">' +
      '<div class="tr-filter" id="trFilter"></div><span class="tr-count" id="trCount"></span></div>' +
      '<div class="turns" id="turns"><div class="loading">원문을 불러오는 중…</div></div>';

    loadTranscript(iv.id, function (turns) {
      var box = document.getElementById("turns");
      if (!box) return;
      if (!turns) { box.innerHTML = '<div class="empty">원문 파일이 아직 없습니다.</div>'; return; }

      var speakers = [];
      turns.forEach(function (t) { if (t.s && speakers.indexOf(t.s) < 0) speakers.push(t.s); });
      var activeSp = "";
      document.getElementById("trFilter").innerHTML = ['<button class="on" data-sp="">전체</button>']
        .concat(speakers.map(function (s) { return '<button data-sp="' + esc(s) + '">' + esc(s) + "</button>"; })).join("");

      function draw() {
        var q = (document.getElementById("trSearch").value || "").trim();
        var nq = norm(q);
        var shown = 0, hits = 0, html = "";
        turns.forEach(function (t, i) {
          var visible = (!activeSp || t.s === activeSp);
          if (nq) {
            var c = norm(t.x).split(nq).length - 1;
            if (!c) visible = false; else hits += c;
          }
          if (visible) shown++;
          var focus = at && t.t === at && !nq;
          html += '<div class="turn ' + roleOf(t.s, iv) + (visible ? "" : " hide") + (focus ? " focus" : "") + '" data-i="' + i + '"><div class="turn-who">' + esc(t.s || "-") +
            '<span class="turn-time">' + esc(t.t) + '</span></div><div class="turn-text">' + hlText(t.x, nq ? [q] : (focus && hl ? [hl] : [])) + "</div></div>";
        });
        box.innerHTML = html;
        document.getElementById("trCount").textContent = nq ? "검색 결과 " + hits + "건 · 발화 " + shown + "개" : "발화 " + shown + "개";
      }
      document.getElementById("trSearch").addEventListener("input", draw);
      document.getElementById("trFilter").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        activeSp = b.getAttribute("data-sp");
        Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.classList.toggle("on", x === b); });
        draw();
      });
      draw();
      if (at) {
        var el = box.querySelector(".turn.focus");
        if (el) setTimeout(function () { el.scrollIntoView({ block: "center" }); }, 30);
      }
    });
  }

  // ---------- global search ----------
  var STOP = ["관련", "관한", "관련된", "대한", "대해", "대해서", "내용", "정보", "알려줘", "보여줘", "찾아줘", "정리", "정리해줘", "어떤", "뭐", "무엇", "있어", "있나", "있는", "부분", "쪽", "것", "거", "좀", "전체", "모든", "모두", "인터뷰"];
  var INTENTS = {
    idea: ["아이디어", "제안", "개선", "개선점", "요청", "바라는", "원하는", "희망", "추가", "바람", "니즈"],
    pain: ["불편", "불편함", "불편한", "불만", "문제", "아쉬운", "아쉬움", "아쉬웠던", "단점", "어려움", "어려운", "페인포인트"],
    pos: ["좋은", "좋았던", "긍정", "긍정적", "장점", "칭찬", "만족", "호평"],
    neg: ["부정", "부정적", "싫은", "불필요", "필요없는", "안쓸", "혹평"],
    quote: ["발언", "인용", "말한", "멘트"]
  };
  var IDEA_MARK = ["좋겠", "했으면", "넣어", "있으면", "바꿔", "해주면", "줬으면", "넣었으면", "하면 어때", "추가", "차라리", "필터", "옵션", "선택권"];
  var PAIN_MARK = ["불편", "귀찮", "답답", "어렵", "짜증", "아쉬", "헷갈"];
  var JOSA = /(으로|에서|에게|하고|이랑|까지|부터|은|는|이|가|을|를|의|에|도|로|와|과)$/;

  function parseQuery(q) {
    var nq = norm(q), feats = [], used = [], viaCore = {}, hit = {};
    FEATURES.forEach(function (F) {
      var co = featCore(F.key), al = featAliases(F.key), i;
      for (i = 0; i < co.length; i++) if (nq.indexOf(norm(co[i])) >= 0) { feats.push(F.key); used.push(norm(co[i])); viaCore[F.key] = true; hit[F.key] = co[i]; return; }
      for (i = 0; i < al.length; i++) if (nq.indexOf(norm(al[i])) >= 0) { feats.push(F.key); used.push(norm(al[i])); hit[F.key] = al[i]; return; }
    });
    var intents = {}, kws = [];
    q.split(/[\s,·/]+/).forEach(function (tok) {
      if (!tok) return;
      var t = tok.length > 2 ? tok.replace(JOSA, "") : tok;
      var nt = norm(t);
      if (!nt) return;
      for (var k in INTENTS) if (INTENTS[k].indexOf(nt) >= 0 || INTENTS[k].indexOf(norm(tok)) >= 0) { intents[k] = true; return; }
      if (STOP.indexOf(nt) >= 0 || STOP.indexOf(norm(tok)) >= 0) return;
      if (used.some(function (u) { return u.indexOf(nt) >= 0 || nt.indexOf(u) >= 0; })) return;
      kws.push(t);
    });
    return { features: feats, intents: intents, keywords: kws, viaCore: viaCore, hit: hit };
  }

  function buildRecords() {
    var recs = [];
    IV.forEach(function (iv) {
      (iv.features || []).forEach(function (f) {
        recs.push({ iv: iv, kind: "feature", fkey: f.key, label: featName(f.key), sentiment: f.sentiment, text: f.reaction, sugg: f.suggestion || "", expect: f.expect || "" });
      });
      (iv.profile || []).forEach(function (p) { recs.push({ iv: iv, kind: "profile", label: "프로필 · " + p.label, text: p.text }); });
      (iv.insights || []).forEach(function (x) { recs.push({ iv: iv, kind: "insight", label: "분석", text: x }); });
      (iv.quotes || []).forEach(function (q) { q = quoteObj(q); recs.push({ iv: iv, kind: "quote", label: "발언 · " + (q.topic || ""), text: "“" + q.text + "”", find: q.find }); });
      var v = iv.verdict || {};
      [["substitute", "대체 가능 여부"], ["retention", "계속 쓸 조건"], ["privacy", "위치·주행 기록 수집"], ["change", "써본 뒤 인상"], ["questions", "궁금해한 점"]].forEach(function (p) {
        if (v[p[0]]) recs.push({ iv: iv, kind: "verdict", label: "종합 평가 · " + p[1], text: v[p[0]] });
      });
    });
    (OV.findings || []).forEach(function (f) { recs.push({ iv: null, kind: "overview", label: "핵심 발견", text: f.title + " — " + f.body }); });
    (OV.opportunities || []).forEach(function (x) { recs.push({ iv: null, kind: "opportunity", label: "기획 반영 후보", text: x }); });
    (OV.betaChecks || []).forEach(function (x) { recs.push({ iv: null, kind: "betacheck", label: "베타에서 확인할 것", text: x }); });
    return recs;
  }

  function scoreRecord(r, P) {
    var hay = norm([r.label, r.text, r.sugg, r.expect].join(" "));
    var s = 0, I = P.intents, hasF = P.features.length > 0, hasK = P.keywords.length > 0;
    if (hasF) {
      if (r.kind === "feature" && P.features.indexOf(r.fkey) >= 0) s += 6;
      else {
        var aliasHit = P.features.some(function (k) { return featAliases(k).some(function (a) { return hay.indexOf(norm(a)) >= 0; }); });
        if (!aliasHit) return 0;
        s += 2;
      }
    }
    var kHits = 0;
    P.keywords.forEach(function (k) { if (hay.indexOf(norm(k)) >= 0) kHits++; });
    if (hasK) {
      if (!hasF && !kHits) return 0;
      s += kHits * 3;
    }
    if (!hasF && !hasK) s = 1; // intent-only query
    if (I.idea) {
      if (r.kind === "feature") { if (!r.sugg) return 0; s += 2; }
      else if (r.kind === "opportunity" || r.kind === "insight") s += 1;
      else if (r.kind === "profile" || r.kind === "verdict") s -= 2;
      else if (r.kind === "quote" && !hasF) return 0;
    }
    if (I.pain) {
      if (r.kind === "feature") { if (r.sentiment === "pos") return 0; s += (r.sentiment === "neg" ? 2 : 1); }
      else if (/불편|귀찮|답답|어렵|아쉬|문제|헷갈/.test(r.text)) s += 2;
    }
    if (I.pos) { if (r.kind === "feature") { if (r.sentiment !== "pos") return 0; s += 2; } else if (r.kind !== "verdict" && r.kind !== "overview") s -= 1; }
    if (I.neg) { if (r.kind === "feature") { if (r.sentiment !== "neg") return 0; s += 2; } else if (r.kind !== "verdict" && r.kind !== "overview") s -= 1; }
    if (I.quote) { if (r.kind === "quote") s += 4; else s -= 2; }
    return s > 0 ? s : 0;
  }

  function searchTranscripts(P) {
    var res = [], hasF = P.features.length > 0, hasK = P.keywords.length > 0;
    if (!hasF && !hasK) return res;
    var TOPIC_SPAN = 6; // 진행자가 기능 이름을 꺼낸 뒤 이어지는 테스터 발화 수
    // 기능 이름(core)으로 찾은 경우: 진행자 질문의 주제를 따라감. 관련어(번호판·과태료 등)로 찾은 경우: 그 단어가 직접 나온 발화만.
    var coreKeys = P.features.filter(function (k) { return P.viaCore[k]; });
    var litKeys = P.features.filter(function (k) { return !P.viaCore[k]; });
    var coreNames = [], coreAll = [], otherCore = [];
    coreKeys.forEach(function (k) { coreNames = coreNames.concat(featCore(k).map(norm)); coreAll = coreAll.concat(featAliases(k).map(norm).filter(function (a) { return a.length >= 3; })); });
    FEATURES.forEach(function (F) { if (coreKeys.indexOf(F.key) < 0) otherCore = otherCore.concat(featCore(F.key).map(norm)); });
    IV.forEach(function (iv) {
      var turns = TRANSCRIPTS[iv.id];
      if (!turns) return;
      var topicLeft = 0;
      turns.forEach(function (t, i) {
        var nx = norm(t.x);
        if (t.s === MOD) {
          if (coreKeys.length) {
            if (coreNames.some(function (a) { return nx.indexOf(a) >= 0; })) topicLeft = TOPIC_SPAN;
            else if (otherCore.some(function (a) { return nx.indexOf(a) >= 0; })) topicLeft = 0;
          }
          return;
        }
        var inTopic = topicLeft > 0;
        if (topicLeft > 0) topicLeft--;
        if (nx.length < 12) return;
        var prev = prevModTurn(turns, i);
        var s = 0;
        if (coreKeys.length) {
          var inX = coreAll.some(function (a) { return nx.indexOf(a) >= 0; });
          if (!inX && !inTopic) return;
          s += inX ? 3 : 2;
        }
        if (litKeys.length) {
          var lit = litKeys.every(function (k) { return nx.indexOf(norm(P.hit[k])) >= 0; });
          if (!lit) return;
          s += 3;
        }
        if (hasK) {
          var kh = 0;
          P.keywords.forEach(function (k) { if (nx.indexOf(norm(k)) >= 0) kh++; });
          if (!hasF && !kh) return;
          s += kh * 3;
          if (!hasF && P.keywords.length > 1 && kh === P.keywords.length) s += 2;
        }
        if (P.intents.idea) { if (IDEA_MARK.some(function (m) { return t.x.indexOf(m) >= 0; })) s += 3; else return; }
        if (P.intents.pain) { if (PAIN_MARK.some(function (m) { return t.x.indexOf(m) >= 0; })) s += 3; else return; }
        if (s > 0) res.push({ iv: iv, turn: t, prev: prev, score: s, idx: i });
      });
    });
    res.sort(function (a, b) { return b.score - a.score || (a.iv.id < b.iv.id ? -1 : 1) || a.idx - b.idx; });
    return res;
  }

  function renderSearch(q) {
    document.getElementById("gSearch").value = q;
    var P = parseQuery(q);
    var terms = P.keywords.slice();
    P.features.forEach(function (k) { terms = terms.concat(featAliases(k)); });

    var chips = [];
    P.features.forEach(function (k) { chips.push('<span class="qchip feat">기능 · ' + esc(featName(k)) + "</span>"); });
    var INAME = { idea: "아이디어·제안", pain: "불편·문제", pos: "긍정 반응", neg: "부정 반응", quote: "발언" };
    Object.keys(P.intents).forEach(function (k) { chips.push('<span class="qchip intent">' + INAME[k] + "</span>"); });
    P.keywords.forEach(function (k) { chips.push('<span class="qchip">' + esc(k) + "</span>"); });

    var h = '<section class="card hero"><div class="eyebrow">검색</div><h1>“' + esc(q) + '”</h1>' +
      (chips.length ? '<div class="qchips"><span class="muted" style="font-size:12px;margin-right:4px">이렇게 찾았어요</span>' + chips.join("") + "</div>" : "") +
      "</section>";

    if (!P.features.length && !P.keywords.length && !Object.keys(P.intents).length) {
      main.innerHTML = h + '<div class="empty">검색어를 조금 더 구체적으로 입력해 주세요. (예: 주행일지 관련 아이디어, 가치봄 불편, 번호판)</div>';
      return;
    }

    var recs = buildRecords().map(function (r) { r.score = scoreRecord(r, P); return r; })
      .filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });

    h += '<section class="section"><h2>요약·분석에서 찾은 내용 <span class="sub">' + recs.length + "건</span></h2>";
    if (!recs.length) h += '<div class="card muted">요약·분석에서 일치하는 내용이 없습니다.</div>';
    else {
      h += '<div class="results">';
      recs.slice(0, 60).forEach(function (r) {
        var who = r.iv ? '<a class="r-who" href="#/i/' + esc(r.iv.id) + '">' + esc(r.iv.name) + "</a>" + typeBadge(r.iv) : '<a class="r-who" href="#/">전체 요약 분석</a>';
        var body;
        if (r.kind === "feature") {
          var showSugg = P.intents.idea && r.sugg;
          body = (showSugg ? '<p class="r-main sugg">제안 · ' + hlText(r.sugg, terms) + "</p>" : "") +
            '<p class="' + (showSugg ? "r-sub" : "r-main") + '">' + hlText(r.text, terms) + "</p>" +
            (!showSugg && r.sugg ? '<p class="r-sub sugg">제안 · ' + hlText(r.sugg, terms) + "</p>" : "");
        } else {
          body = '<p class="r-main">' + hlText(r.text, terms) + "</p>";
        }
        var link = r.kind === "quote" && r.find ? ' <a class="r-link" href="' + trLink(r.iv.id, "", "") + '" data-find="' + esc(r.find) + '" data-iv="' + esc(r.iv.id) + '">원문 →</a>' : "";
        h += '<div class="result"><div class="r-head">' + who + '<span class="r-label">' + esc(r.label) + "</span>" +
          (r.kind === "feature" ? senti(r.sentiment) : "") + link + "</div>" + body + "</div>";
      });
      h += "</div>";
    }
    h += "</section>";
    h += '<section class="section" id="trResults"><h2>원문에서 찾은 발화</h2><div class="card loading">원문을 검색하는 중…</div></section>';
    main.innerHTML = h;

    // quote links → jump to exact turn
    Array.prototype.forEach.call(main.querySelectorAll(".r-link[data-find]"), function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("data-iv"), find = a.getAttribute("data-find");
        loadTranscript(id, function (turns) {
          var i = findTurn(turns, find);
          location.hash = trLink(id, i >= 0 ? turns[i].t : "", find).slice(1);
        });
      });
    });

    loadAllTranscripts(function () {
      var box = document.getElementById("trResults");
      if (!box) return;
      var res = searchTranscripts(P);
      var hh = '<h2>원문에서 찾은 발화 <span class="sub">' + res.length + "건" + (res.length > 40 ? " · 관련도 높은 40건 표시" : "") + "</span></h2>";
      if (!res.length) hh += '<div class="card muted">원문에서 일치하는 발화가 없습니다.</div>';
      else {
        hh += '<div class="results">';
        res.slice(0, 40).forEach(function (r) {
          hh += '<div class="result tr"><div class="r-head"><a class="r-who" href="#/i/' + esc(r.iv.id) + '">' + esc(r.iv.name) + "</a>" + typeBadge(r.iv) +
            '<span class="r-label">' + esc(r.turn.t) + '</span><a class="r-link" href="' + trLink(r.iv.id, r.turn.t, P.keywords[0] || "") + '">원문에서 보기 →</a></div>' +
            (r.prev ? '<p class="r-q"><b>진행자</b> ' + hlText(r.prev.x, terms, 110) + "</p>" : "") +
            '<p class="r-main">' + hlText(r.turn.x, terms, 280) + "</p></div>";
        });
        hh += "</div>";
      }
      box.innerHTML = hh;
    });
  }

  // ---------- router ----------
  function parseHash() {
    var raw = location.hash.replace(/^#/, "") || "/";
    var qi = raw.indexOf("?"), path = qi >= 0 ? raw.slice(0, qi) : raw, params = {};
    if (qi >= 0) raw.slice(qi + 1).split("&").forEach(function (kv) {
      var p = kv.split("="); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || "").replace(/\+/g, " "));
    });
    return { path: path, params: params };
  }
  function route() {
    document.body.classList.remove("nav-open");
    var H = parseHash();
    var m = /^\/i\/([^/]+)(\/transcript)?$/.exec(H.path);
    if (H.path !== "/search") document.getElementById("gSearch").value = "";
    if (H.path === "/search") {
      renderNav(null, false);
      document.title = "검색: " + (H.params.q || "") + " · FINE Alaseo 베타 사전 인터뷰";
      renderSearch(H.params.q || "");
    } else if (m) {
      var iv = byId(decodeURIComponent(m[1]));
      renderNav(iv ? iv.id : null, false);
      if (!iv) { main.innerHTML = '<div class="empty">해당 인터뷰를 찾을 수 없습니다. <a href="#/" style="color:var(--brand)">전체 요약으로</a></div>'; return; }
      document.title = iv.name + (m[2] ? " 원문" : " 요약") + " · FINE Alaseo 베타 사전 인터뷰";
      if (m[2]) renderTranscript(iv, H.params); else renderInterview(iv);
    } else {
      renderNav(null, true);
      document.title = "FINE Alaseo 베타 사전 인터뷰";
      renderOverview();
    }
    if (!(m && m[2] && H.params.at)) window.scrollTo(0, 0);
  }

  document.getElementById("updated").textContent = OV.updated ? "최종 반영 " + OV.updated : "";
  document.getElementById("menuBtn").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
  document.getElementById("gSearchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = document.getElementById("gSearch").value.trim();
    if (q) location.hash = "#/search?q=" + encodeURIComponent(q);
  });
  window.addEventListener("hashchange", route);
  route();
})();
