#!/usr/bin/env python3
"""사전 설문(구글폼 응답 xlsx) → data/surveys.js

인터뷰를 마친 테스터만 사이트에 넣습니다. 닉네임과 인터뷰 id를 짝지어 넘깁니다.
  python3 tools/build_surveys.py 설문.xlsx data/surveys.js --map "닉네임=i03" --map "다른닉네임=i04" ...

공개 저장소용 비식별 처리:
- 닉네임은 저장하지 않음 (id로만 연결)
- 나이는 연령대(30대 등)로, 지역은 시·군·구까지만
"""
import json
import re
import sys

import openpyxl

LEVELS = ["매우 관심있음", "관심있음", "보통", "관심없음", "전혀 관심없음"]


def age_band(v):
    s = str(v or "")
    m = re.search(r"(\d{2})", s)
    if not m:
        return s.strip()
    n = int(m.group(1))
    if "대" in s and n % 10 == 0:
        return f"{n}대"
    return f"{n // 10 * 10}대"


def region(v):
    s = re.sub(r"\s+", " ", str(v or "")).strip()
    parts = s.split(" ")
    keep = []
    for p in parts:
        keep.append(p)
        if re.search(r"(구|군)$", p) or (re.search(r"시$", p) and len(keep) >= 2):
            break
    out = " ".join(keep)
    out = re.sub(r"^경시 ", "경기도 ", out)
    # 시 단위로 끝나지 않은 경우(예: '서울시 강남구 도곡동') 동·읍 단위 제거
    out = re.sub(r"\s+\S+(동|읍|면|리)$", "", out)
    return out


def main():
    src, out = sys.argv[1], sys.argv[2]
    mp = {}
    args = sys.argv[3:]
    for i, a in enumerate(args):
        if a == "--map":
            k, v = args[i + 1].split("=", 1)
            mp[k.strip()] = v.strip()

    ws = openpyxl.load_workbook(src, data_only=True).worksheets[0]
    hdr = [str(c.value or "") for c in ws[1]]

    def col(*keys):
        for i, h in enumerate(hdr):
            if all(k in h for k in keys):
                return i
        raise KeyError(keys)

    C = {
        "ts": 0, "nick": col("닉네임"), "age": col("나이"), "region": col("지역"), "house": col("거주형태"),
        "park_home": col("거주지에서 주차"), "park_new": col("낯선 곳"), "career": col("운전경력"),
        "car": col("보유 차량"), "freq": col("운전 빈도"), "use": col("언제 사용"),
        "bb": col("블랙박스는 무엇"), "battery": col("보조배터리"), "app": col("블랙박스 앱을 사용"),
        "last": col("마지막으로 확인"), "how": col("확인한 방법"), "pain": col("불편한 점"),
        "accident": col("교통사고"), "ding": col("물피도주를 당한"), "ding_act": col("어떻게 행동"),
        "apps": col("자동차 관련 앱"), "report": col("교통위반 신고"), "service": col("어떤 서비스를 제공"),
        "words": col("첫 인상에 가까운"), "reason": col("선택하신 이유"),
    }
    interest_cols = [(i, re.search(r"\[(.+)\]", h).group(1).strip()) for i, h in enumerate(hdr) if "경험해 보고 싶은 메뉴" in h and "[" in h]

    data, unmatched = {}, []
    for r in ws.iter_rows(min_row=2, values_only=True):
        nick = str(r[C["nick"]] or "").strip()
        iid = mp.get(nick)
        if not iid:
            unmatched.append(nick)
            continue
        g = lambda k: ("" if r[C[k]] is None else str(r[C[k]]).strip())
        ts = r[C["ts"]]
        data[iid] = {
            "submitted": ts.strftime("%Y-%m-%d %H:%M") if hasattr(ts, "strftime") else str(ts)[:16],
            "basic": [["연령대", age_band(g("age"))], ["지역", region(g("region"))], ["거주 형태", g("house")],
                      ["거주지 주차", g("park_home")], ["낯선 곳 주차", g("park_new")], ["운전 경력", g("career")],
                      ["보유 차량", g("car")], ["주간 운전 빈도", g("freq")], ["주 사용 형태", g("use")]],
            "blackbox": [["블랙박스", g("bb")], ["보조배터리", g("battery")], ["블랙박스 앱", g("app")],
                         ["마지막 영상 확인", g("last")], ["영상 확인 방법", g("how")], ["앱 연결·사용 불편", g("pain")]],
            "incident": [["최근 5년 교통사고", g("accident")], ["문콕·물피도주", g("ding")], ["당시 대응", g("ding_act")],
                         ["교통위반 신고 경험", g("report")]],
            "apps": g("apps"),
            "service": g("service"),
            "words": [w.strip() for w in g("words").split(",") if w.strip()],
            "interest": [{"name": name, "level": ("" if r[i] is None else str(r[i]).strip())} for i, name in interest_cols],
            "reason": g("reason"),
        }

    with open(out, "w", encoding="utf-8") as f:
        f.write("// 자동 생성 파일: tools/build_surveys.py 로 만들어집니다. 직접 수정하지 마세요.\n")
        f.write("// 인터뷰를 마친 테스터의 사전 설문만 포함합니다 (닉네임 미포함, 연령대·시군구 단위로 비식별).\n")
        f.write("window.SURVEY_LEVELS = %s;\n" % json.dumps(LEVELS, ensure_ascii=False))
        f.write("window.SURVEYS = %s;\n" % json.dumps(data, ensure_ascii=False, indent=1))
    print("included:", sorted(data))
    print("not included (인터뷰 전):", len(unmatched))


if __name__ == "__main__":
    main()
