"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./group-order-guide.module.css";

type Need = "identity" | "activity" | "event";
type OrderType = "custom" | "bulk" | "undecided";

const needs: { id: Need; number: string; title: string; description: string; example: string }[] = [
  { id: "identity", number: "01", title: "우리 팀답게", description: "크루명이나 로고처럼 함께한다는 표시가 필요해요.", example: "러닝크루 · 동호회 · 브랜드팀" },
  { id: "activity", number: "02", title: "편하게 움직이게", description: "활동 환경에 맞는 옷을 여러 명이 입어야 해요.", example: "매장 · 현장팀 · 운영 스태프" },
  { id: "event", number: "03", title: "같은 날, 같은 모습으로", description: "행사나 모임 날짜에 맞춰 팀을 알아볼 수 있어야 해요.", example: "행사 · 봉사 · 학교 · 기업" },
];

const quantities = ["10벌 미만", "10~49벌", "50~99벌", "100벌 이상", "미정"];

const faqs = [
  { q: "필요한 수량이 아직 정확하지 않아요.", a: "대략적인 인원만 알려주셔도 상담을 시작할 수 있습니다. 정확한 견적은 상품과 수량, 사이즈 구성을 확인한 뒤 안내합니다." },
  { q: "로고 없이 같은 옷을 여러 벌 구매할 수 있나요?", a: "네. 기성 상품 대량구매로 문의해 주세요. 관심 상품의 색상·사이즈·필요 수량을 알려주시면 재고와 공급 가능 여부를 확인합니다." },
  { q: "팀 이름이나 로고를 넣을 수 있나요?", a: "상품과 적용 방식에 따라 다릅니다. 로고 파일, 원하는 위치와 색상을 알려주시면 가능 여부를 확인해 안내합니다." },
  { q: "언제까지 받을 수 있나요?", a: "상품 재고와 수량, 추가 작업, 납품 지역에 따라 달라집니다. 필요한 날짜를 알려주시면 가능한 일정을 상담해 드립니다." },
];

export default function GroupOrderGuide() {
  const localPreview = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const [need, setNeed] = useState<Need>("identity");
  const [orderType, setOrderType] = useState<OrderType>("undecided");
  const [quantity, setQuantity] = useState("미정");
  const [form, setForm] = useState({ organization: "", name: "", phone: "", date: "", product: "", details: "", privacy: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const chosenNeed = needs.find((item) => item.id === need)!;
  const orderLabel = orderType === "custom" ? "로고·문구가 필요한 단체복" : orderType === "bulk" ? "기성 상품 대량구매" : "상담하며 결정";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.privacy) {
      setError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    if (localPreview) {
      setError("");
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    setError("");
    const message = [
      `가장 중요한 목적: ${chosenNeed.title}`,
      `구매 방식: ${orderLabel}`,
      `예상 수량: ${quantity}`,
      `관심 상품: ${form.product.trim() || "미정"}`,
      `필요한 날짜: ${form.date || "미정"}`,
      `추가 요청: ${form.details.trim() || "없음"}`,
    ].join("\n");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "support",
          payload: {
            subject: "단체복·대량구매 가이드 상담",
            name: form.name.trim(),
            phone: form.phone.trim(),
            company: form.organization.trim(),
            need,
            orderType,
            quantity,
            desiredDate: form.date,
            productName: form.product.trim(),
            privacyAgree: "yes",
            message,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "문의 접수에 실패했습니다.");
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "문의 접수에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={styles.page}>
    <section className={styles.hero} aria-labelledby="guide-title"><div className={styles.container}>
      <div className={styles.heroTop}><span>WORKUP / GROUP ORDER GUIDE</span><span>단체복 · 대량구매</span></div>
      <div className={styles.heroGrid}><div><p className={styles.kicker}>함께 입을 옷을 준비하는 가장 쉬운 시작</p><h1 id="guide-title">우리 팀의 옷,<br /><em>어디서부터</em><br />고르면 될까요?</h1></div><div className={styles.heroAside}><p>러닝크루의 첫 티셔츠부터 행사 스태프의 유니폼, 회사의 동일 상품 구매까지. 먼저 필요한 이유를 정리하면 선택이 쉬워집니다.</p><a href="#start" className={styles.heroCta}>3분 만에 상담 내용 정리하기 <span aria-hidden>↗</span></a></div></div>
      <div className={styles.heroFooter}><span>목적 정하기</span><span>방식 고르기</span><span>견적 요청하기</span></div>
    </div></section>

    <nav className={styles.nav} aria-label="페이지 구성"><div className={styles.container}><a href="#purpose">01 목적</a><a href="#choice">02 구매 방식</a><a href="#checklist">03 준비할 내용</a><a href="#start">04 상담하기</a></div></nav>

    <section id="purpose" className={`${styles.section} ${styles.purpose}`} aria-labelledby="purpose-title"><div className={styles.container}>
      <div className={styles.sectionIntro}><p className={styles.sectionNumber}>01 / PURPOSE</p><h2 id="purpose-title">누가 입는지보다,<br /><em>왜 입는지</em> 먼저.</h2><p>단체의 종류가 달라도 필요한 이유는 비슷합니다. 지금 가장 가까운 생각을 골라보세요.</p></div>
      <div className={styles.needGrid}>{needs.map((item) => <button key={item.id} type="button" className={`${styles.needCard} ${need === item.id ? styles.needActive : ""}`} aria-pressed={need === item.id} onClick={() => setNeed(item.id)}><span className={styles.cardTop}><span>{item.number}</span><span aria-hidden>{need === item.id ? "●" : "○"}</span></span><strong>{item.title}</strong><span className={styles.needDescription}>{item.description}</span><small>{item.example}</small></button>)}</div>
      <p className={styles.inlineNote}>선택한 목적은 아래 상담 내용에 자동으로 담깁니다.</p>
    </div></section>

    <section id="choice" className={`${styles.section} ${styles.choice}`} aria-labelledby="choice-title"><div className={styles.container}>
      <div className={styles.sectionIntro}><p className={styles.sectionNumber}>02 / HOW TO BUY</p><h2 id="choice-title">원하는 결과에 따라<br />방법이 달라집니다.</h2><p>두 방식 모두 제품·수량·일정을 확인한 뒤 상담으로 진행합니다.</p></div>
      <div className={styles.choiceGrid}>
        <article className={styles.choiceCard}><div className={styles.choiceHead}><span>A / TEAMWEAR</span><span aria-hidden>↗</span></div><h3>팀의 표시가<br />필요하다면</h3><p>로고, 크루명, 행사 문구처럼 단체를 알아볼 수 있는 요소를 옷에 담고 싶을 때.</p><dl><div><dt>먼저 정하면 좋은 것</dt><dd>원하는 상품 종류 · 로고 파일 · 위치 · 예상 수량</dd></div><div><dt>상담에서 확인할 것</dt><dd>상품별 적용 가능 여부 · 작업 방식 · 견적과 일정</dd></div></dl><button type="button" onClick={() => { setOrderType("custom"); document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); }}>맞춤 단체복으로 문의 <span aria-hidden>↗</span></button></article>
        <article className={styles.choiceCard}><div className={styles.choiceHead}><span>B / BULK PURCHASE</span><span aria-hidden>↗</span></div><h3>필요한 상품을<br />여러 벌 준비한다면</h3><p>로고 작업 없이 같은 제품을 팀원에게 맞는 색상과 사이즈로 준비하고 싶을 때.</p><dl><div><dt>먼저 정하면 좋은 것</dt><dd>관심 상품 · 색상 · 사이즈 구성 · 예상 수량</dd></div><div><dt>상담에서 확인할 것</dt><dd>재고와 공급 가능 여부 · 견적과 일정</dd></div></dl><button type="button" onClick={() => { setOrderType("bulk"); document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); }}>대량구매로 문의 <span aria-hidden>↗</span></button></article>
      </div>
      <div className={styles.undecided}><span>아직 어떤 방식인지 모르겠나요?</span><strong>상품이나 수량이 정해지지 않아도 상담을 시작할 수 있습니다.</strong><button type="button" onClick={() => { setOrderType("undecided"); document.getElementById("start")?.scrollIntoView({ behavior: "smooth" }); }}>함께 정하기 ↗</button></div>
    </div></section>

    <section id="checklist" className={`${styles.section} ${styles.checklist}`} aria-labelledby="checklist-title"><div className={styles.container}>
      <div className={styles.sectionIntro}><p className={styles.sectionNumber}>03 / WHAT MATTERS</p><h2 id="checklist-title">견적을 바꾸는 건<br />이 다섯 가지입니다.</h2><p>정확히 몰라도 괜찮습니다. 알고 있는 것만 적으면 상담이 한결 빨라집니다.</p></div>
      <div className={styles.checkRows}>{[
        ["01", "상품", "티셔츠, 셔츠, 조끼, 아우터 등 어떤 옷을 찾고 있나요?"],
        ["02", "수량", "대략적인 인원과 필요한 벌 수는 얼마인가요?"],
        ["03", "사이즈·색상", "한 가지로 맞출지, 사람마다 나누어 준비할지 정해 보세요."],
        ["04", "추가 작업", "로고나 문구가 필요한지, 파일이 준비돼 있는지 알려주세요."],
        ["05", "필요한 날짜", "행사일이나 착용 예정일이 있다면 먼저 공유해 주세요."],
      ].map(([number, title, description]) => <div className={styles.checkRow} key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p><span aria-hidden>↗</span></div>)}</div>
      <div className={styles.catalogStrip}><div><span>실물을 보고 고르고 싶다면</span><strong>카탈로그를 살펴보고, 가까운 매장에서 소재와 착용감을 확인해 보세요.</strong><small>방문 전 원하는 제품의 취급 여부를 매장에 문의해 주세요.</small></div><div><Link href="/products">제품 살펴보기 ↗</Link><Link href="/store">매장 찾기 ↗</Link></div></div>
    </div></section>

    <section className={`${styles.section} ${styles.flow}`} aria-labelledby="flow-title"><div className={styles.container}><div className={styles.sectionIntro}><p className={styles.sectionNumber}>AFTER YOUR INQUIRY</p><h2 id="flow-title">문의 이후에는<br />이렇게 이어집니다.</h2></div><ol><li><span>01</span><strong>내용 확인</strong><p>용도, 상품, 수량과 희망 일정을 확인합니다.</p></li><li><span>02</span><strong>가능 여부 검토</strong><p>재고와 추가 작업 가능 여부를 살펴봅니다.</p></li><li><span>03</span><strong>견적 안내</strong><p>확인된 조건에 맞춰 금액과 일정을 안내합니다.</p></li><li><span>04</span><strong>진행 결정</strong><p>상담 결과를 보고 진행 여부를 결정합니다.</p></li></ol></div></section>

    <section id="start" className={`${styles.section} ${styles.contact}`} aria-labelledby="contact-title"><div className={`${styles.container} ${styles.contactGrid}`}><div className={styles.contactIntro}><p className={styles.sectionNumber}>04 / YOUR BRIEF</p><h2 id="contact-title">알고 있는 것부터<br />들려주세요.</h2><p>선택한 내용이 문의에 함께 담깁니다. 아직 미정인 항목은 그대로 두셔도 됩니다.</p><div className={styles.brief}><span>지금까지 고른 내용</span><strong>{chosenNeed.title}</strong><strong>{orderLabel}</strong><strong>수량 {quantity}</strong></div></div><div className={styles.formPanel}>{submitted ? <div className={styles.success} role="status"><span aria-hidden>✓</span><h3>{localPreview ? "화면 확인을 마쳤습니다." : "문의가 접수되었습니다."}</h3><p>{localPreview ? "검토용 시안에서는 문의가 저장되지 않습니다." : "남겨주신 연락처로 상담을 이어가겠습니다."}</p><button type="button" onClick={() => setSubmitted(false)}>다시 작성하기</button></div> : <form onSubmit={submit}>
        <div className={styles.formSection}><span>01 / 필요한 것</span><fieldset><legend>구매 방식</legend><div className={styles.radioGrid}><label><input type="radio" name="order-type" checked={orderType === "custom"} onChange={() => setOrderType("custom")} /> 맞춤 단체복</label><label><input type="radio" name="order-type" checked={orderType === "bulk"} onChange={() => setOrderType("bulk")} /> 기성 상품 대량구매</label><label><input type="radio" name="order-type" checked={orderType === "undecided"} onChange={() => setOrderType("undecided")} /> 상담하며 결정</label></div></fieldset><label>예상 수량<select value={quantity} onChange={(event) => setQuantity(event.target.value)}>{quantities.map((item) => <option key={item}>{item}</option>)}</select></label><label>관심 상품 <small>선택</small><input value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} placeholder="예: 반팔 티셔츠, 조끼, 아우터" maxLength={200} /></label><label>필요한 날짜 <small>선택</small><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div>
        <div className={styles.formSection}><span>02 / 연락 받을 곳</span><div className={styles.formColumns}><label>단체명 <small>선택</small><input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} placeholder="단체 또는 회사 이름" autoComplete="organization" maxLength={80} /></label><label>담당자명 <em>*</em><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="이름" autoComplete="name" maxLength={40} required /></label></div><label>연락처 <em>*</em><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="010-0000-0000" autoComplete="tel" minLength={8} maxLength={20} required /></label><label>추가 요청 <small>선택</small><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="용도, 색상, 사이즈 구성, 로고 작업 등을 자유롭게 적어 주세요." maxLength={1500} rows={4} /></label></div>
        <label className={styles.privacy}><input type="checkbox" checked={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.checked })} required /><span><strong>[필수]</strong> 문의 접수와 상담을 위한 개인정보 수집·이용에 동의합니다. <Link href="/privacy" target="_blank">내용 보기</Link></span></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "접수 중…" : localPreview ? "문의 화면 확인하기 (검토용 시안)" : "이 내용으로 상담 문의하기"}<span aria-hidden>↗</span></button>
      </form>}</div></div></section>

    <section className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div className={`${styles.container} ${styles.faqGrid}`}><div className={styles.sectionIntro}><p className={styles.sectionNumber}>QUESTIONS</p><h2 id="faq-title">궁금할 만한<br />이야기들.</h2></div><div>{faqs.map((item) => <details key={item.q}><summary>{item.q}<span aria-hidden>+</span></summary><p>{item.a}</p></details>)}</div></div></section>
  </main>;
}
