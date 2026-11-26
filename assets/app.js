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

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
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

  // ---------- sidebar ----------
  function renderNav(activeId) {
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
    document.getElementById("navOverview").classList.toggle("active", !activeId);
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

    // findings
    if (OV.findings && OV.findings.length) {
      h += '<section class="section"><h2>핵심 발견</h2><div class="findings">';
      OV.findings.forEach(function (f, i) {
        h += '<div class="finding"><div class="finding-no">' + String(i + 1).padStart(2, "0") + "</div>" +
          "<h3>" + esc(f.title) + "</h3><p>" + esc(f.body) + "</p>" +
          (f.evidence ? '<div class="ev">근거: ' + esc(f.evidence) + "</div>" : "") + "</div>";
      });
      h += "</div></section>";
    }

    // feature matrix
    h += '<section class="section"><h2>기능별 반응 <span class="sub">인터뷰 데이터에서 자동 집계</span></h2>' +
      '<div class="legend">' + ["pos", "mix", "neu", "neg", "na"].map(senti).join("") + "</div>" +
      '<div class="table-wrap"><table class="matrix"><thead><tr><th class="rowhead">기능</th>';
    list.forEach(function (iv) {
      h += '<th class="col"><a href="#/i/' + esc(iv.id) + '">' + esc(iv.name) + "</a><div class=\"muted\" style=\"font-weight:500\">" + esc(iv.type) + "</div></th>";
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
    h += "</tbody></table></div><p class=\"muted\" style=\"font-size:12px;margin:8px 2px 0\">칸에 마우스를 올리면 해당 테스터의 반응 요약이 보입니다.</p></section>";

    // user types
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

    // opportunities / beta checks
    h += '<section class="section two-col">';
    h += '<div class="card"><h2>기획 반영 후보</h2><ol class="list">' + (OV.opportunities || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>";
    h += '<div class="card"><h2>베타테스트에서 확인할 것</h2><ol class="list">' + (OV.betaChecks || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div>";
    h += "</section>";

    // baseline
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
  function renderInterview(iv) {
    var h = "";
    h += '<section class="card hero"><div class="detail-head"><div>' +
      '<div class="eyebrow">인터뷰 요약</div>' +
      "<h1>" + esc(iv.name) + " " + typeBadge(iv) + "</h1>" +
      '<div class="meta-row"><span><b>일시</b> ' + esc(fmtDate(iv.date, iv.time)) + "</span>" +
      (iv.duration ? "<span><b>소요</b> " + esc(iv.duration) + "</span>" : "") +
      (iv.source ? "<span><b>구분</b> " + esc(iv.source) + "</span>" : "") +
      (iv.persona ? "<span><b>유형</b> " + esc(iv.persona) + "</span>" : "") + "</div></div>" +
      '<a class="btn primary" href="#/i/' + esc(iv.id) + '/transcript">원문 보기 →</a></div>' +
      (iv.headline ? '<p class="headline">' + esc(iv.headline) + "</p>" : "") +
      ((iv.tags || []).length ? '<div style="margin-top:14px">' + iv.tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
      (iv.caveat ? '<div class="note">' + esc(iv.caveat) + "</div>" : "") +
      "</section>";

    // profile
    if ((iv.profile || []).length) {
      h += '<section class="section"><h2>테스터 프로필</h2><div class="card"><dl class="profile">';
      iv.profile.forEach(function (p) { h += "<dt>" + esc(p.label) + "</dt><dd>" + esc(p.text) + "</dd>"; });
      h += "</dl></div></section>";
    }

    // features
    if ((iv.features || []).length) {
      h += '<section class="section"><h2>기능별 반응</h2><div class="table-wrap"><table class="feat-table"><thead><tr>' +
        "<th>기능</th><th>반응</th><th>핵심 반응</th><th>제안</th></tr></thead><tbody>";
      FEATURES.forEach(function (F) {
        var f = featOf(iv, F.key);
        if (!f) return;
        h += '<tr><td class="rowhead">' + esc(F.name) + (f.expect ? '<span class="exp">기대: ' + esc(f.expect) + "</span>" : "") + "</td>" +
          "<td>" + senti(f.sentiment) + "</td><td>" + esc(f.reaction) + '</td><td class="sugg">' + esc(f.suggestion || "") + "</td></tr>";
      });
      // features not in FEATURES list
      iv.features.forEach(function (f) {
        if (FEATURES.some(function (F) { return F.key === f.key; })) return;
        h += '<tr><td class="rowhead">' + esc(f.name || f.key) + "</td><td>" + senti(f.sentiment) + "</td><td>" + esc(f.reaction) + '</td><td class="sugg">' + esc(f.suggestion || "") + "</td></tr>";
      });
      h += "</tbody></table></div></section>";
    }

    // verdict
    var v = iv.verdict || {};
    var vItems = [];
    if ((v.good || []).length || (v.bad || []).length) {
      vItems.push('<div class="card"><h3>좋았던 기능</h3>' + (v.good || []).map(function (x) { return '<span class="chip-good">' + esc(x) + "</span>"; }).join("") +
        '<h3 style="margin-top:12px">쓰지 않을 기능</h3>' + (v.bad || []).map(function (x) { return '<span class="chip-bad">' + esc(x) + "</span>"; }).join("") + "</div>");
    }
    [["substitute", "대체 가능 여부"], ["retention", "계속 쓸 조건"], ["privacy", "위치·주행 기록 수집"], ["change", "써본 뒤 인상"], ["questions", "테스터가 궁금해한 점"]].forEach(function (p) {
      if (v[p[0]]) vItems.push('<div class="card"><h3>' + p[1] + "</h3><p>" + esc(v[p[0]]) + "</p></div>");
    });
    if (vItems.length) h += '<section class="section"><h2>종합 평가</h2><div class="verdict">' + vItems.join("") + "</div></section>";

    // insights
    if ((iv.insights || []).length) {
      h += '<section class="section"><h2>분석</h2><div class="card"><ol class="list">' +
        iv.insights.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></div></section>";
    }

    // quotes
    if ((iv.quotes || []).length) {
      h += '<section class="section"><h2>인상적인 발언</h2><div class="quotes">' +
        iv.quotes.map(function (q) { return "<blockquote>“" + esc(q) + "”</blockquote>"; }).join("") + "</div></section>";
    }

    // baseline
    if (iv.baseline) {
      h += '<section class="section"><h2>기준선 (Baseline)</h2><div class="card"><dl class="profile">';
      BASE.forEach(function (b) {
        var val = iv.baseline[b.key];
        h += "<dt>" + esc(b.name) + "</dt><dd>" + (val ? esc(val) : '<span class="muted">미확인</span>') + "</dd>";
      });
      h += "</dl></div></section>";
    }

    h += '<section class="section"><a class="btn" href="#/i/' + esc(iv.id) + '/transcript">원문 전체 보기 →</a></section>';
    main.innerHTML = h;
  }

  // ---------- transcript ----------
  window.__registerTranscript = function (id, turns) { TRANSCRIPTS[id] = turns; };

  function loadTranscript(id, cb) {
    if (TRANSCRIPTS[id]) return cb(TRANSCRIPTS[id]);
    var s = document.createElement("script");
    s.src = "data/transcripts/" + encodeURIComponent(id) + ".js?v=" + (OV.updated || "");
    s.onload = function () { cb(TRANSCRIPTS[id] || null); };
    s.onerror = function () { cb(null); };
    document.body.appendChild(s);
  }

  function roleOf(name, iv) {
    if (name === "진행자") return "mod";
    if (name === iv.name || name === iv.speaker) return "tester";
    return "other";
  }

  function renderTranscript(iv) {
    main.innerHTML =
      '<section class="card hero"><div class="detail-head"><div>' +
      '<div class="eyebrow">인터뷰 원문</div><h1>' + esc(iv.name) + " " + typeBadge(iv) + "</h1>" +
      '<div class="meta-row"><span><b>일시</b> ' + esc(fmtDate(iv.date, iv.time)) + "</span>" +
      (iv.duration ? "<span><b>소요</b> " + esc(iv.duration) + "</span>" : "") + "</div>" +
      '<p class="muted" style="margin:0;font-size:13px">녹취 자동 변환본입니다. 인식 오류가 있을 수 있고, 진행자는 \'진행자\', 그 외 실명은 성+OO로 표기했습니다.</p></div>' +
      '<a class="btn" href="#/i/' + esc(iv.id) + '">← 요약으로</a></div></section>' +
      '<div class="tr-toolbar"><input class="tr-search" id="trSearch" type="search" placeholder="원문에서 검색 (예: 문콕, 과실, 같이 봄)">' +
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
        var re = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
        var shown = 0, hits = 0, html = "";
        turns.forEach(function (t) {
          var text = esc(t.x);
          var visible = (!activeSp || t.s === activeSp);
          if (re) {
            var m = t.x.match(re);
            if (!m) visible = false; else { hits += m.length; text = text.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), function (x) { return "<mark>" + x + "</mark>"; }); }
          }
          if (visible) shown++;
          html += '<div class="turn ' + roleOf(t.s, iv) + (visible ? "" : " hide") + '"><div class="turn-who">' + esc(t.s || "-") +
            '<span class="turn-time">' + esc(t.t) + '</span></div><div class="turn-text">' + text + "</div></div>";
        });
        box.innerHTML = html;
        document.getElementById("trCount").textContent = re ? "검색 결과 " + hits + "건 · 발화 " + shown + "개" : "발화 " + shown + "개";
      }
      document.getElementById("trSearch").addEventListener("input", draw);
      document.getElementById("trFilter").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        activeSp = b.getAttribute("data-sp");
        Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.classList.toggle("on", x === b); });
        draw();
      });
      draw();
    });
  }

  // ---------- router ----------
  function route() {
    document.body.classList.remove("nav-open");
    var hash = location.hash.replace(/^#/, "") || "/";
    var m = /^\/i\/([^/]+)(\/transcript)?$/.exec(hash);
    if (m) {
      var iv = byId(decodeURIComponent(m[1]));
      renderNav(iv ? iv.id : null);
      if (!iv) { main.innerHTML = '<div class="empty">해당 인터뷰를 찾을 수 없습니다. <a href="#/" style="color:var(--brand)">전체 요약으로</a></div>'; return; }
      document.title = iv.name + (m[2] ? " 원문" : " 요약") + " · FINE Alaseo 베타 사전 인터뷰";
      if (m[2]) renderTranscript(iv); else renderInterview(iv);
    } else {
      renderNav(null);
      document.title = "FINE Alaseo 베타 사전 인터뷰";
      renderOverview();
    }
    window.scrollTo(0, 0);
  }

  document.getElementById("updated").textContent = OV.updated ? "최종 반영 " + OV.updated : "";
  document.getElementById("menuBtn").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
  window.addEventListener("hashchange", route);
  route();
})();
