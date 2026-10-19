"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./team-order.module.css";

type Purpose = "uniform" | "bulk";
type Group = "running" | "club" | "event" | "business" | "work" | "other";

const groups: { id: Group; name: string; caption: string; symbol: string }[] = [
  { id: "running", name: "러닝크루", caption: "함께 달리는 날의 팀웨어", symbol: "↗" },
  { id: "club", name: "동호회·모임", caption: "우리만의 소속감을 입는 옷", symbol: "✳" },
  { id: "event", name: "행사·봉사팀", caption: "한눈에 알아보는 팀의 옷", symbol: "◉" },
  { id: "business", name: "기업·매장", caption: "브랜드의 인상을 맞추는 옷", symbol: "▣" },
  { id: "work", name: "현장·작업팀", caption: "움직임에 맞춘 실용적인 옷", symbol: "＋" },
  { id: "other", name: "그 밖의 단체", caption: "필요한 용도를 이야기해 주세요", symbol: "→" },
];

const quantities = ["10벌 미만", "10~49벌", "50~99벌", "100벌 이상", "아직 미정"];

const faqs = [
  { question: "몇 벌부터 문의할 수 있나요?", answer: "수량이 정해지지 않아도 문의할 수 있습니다. 필요한 제품과 예상 수량을 바탕으로 공급 가능 여부를 확인해 안내합니다." },
  { question: "기성 상품을 여러 벌 구매할 수도 있나요?", answer: "가능한 상품과 재고를 확인해 대량구매 상담을 진행합니다. 색상과 사이즈를 나누어 필요한 경우 함께 알려주세요." },
  { question: "크루 이름이나 로고를 넣을 수 있나요?", answer: "상품과 적용 방식에 따라 가능 여부가 다릅니다. 로고 파일 유무, 원하는 위치와 색상을 알려주시면 확인해 안내합니다." },
  { question: "가격과 납기는 언제 알 수 있나요?", answer: "상품, 수량, 재고, 추가 작업과 희망 일정이 확인된 뒤 견적과 가능한 일정을 안내합니다." },
];

export default function TeamOrderPage() {
  const isLocalPreview = process.env.NODE_ENV === "development";
  const [purpose, setPurpose] = useState<Purpose>("uniform");
  const [group, setGroup] = useState<Group>("running");
  const [quantity, setQuantity] = useState("아직 미정");
  const [form, setForm] = useState({ organization: "", name: "", phone: "", date: "", products: "", details: "", privacy: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const selectedGroup = groups.find((item) => item.id === group)!;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.privacy) {
      setError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    if (isLocalPreview) {
      setError("");
      setSubmitted(true);
      return;
    }
    setSubmitting(true);
    setError("");
    const details = [
      `문의 종류: ${purpose === "uniform" ? "맞춤 단체복" : "기성 상품 대량구매"}`,
      `단체 유형: ${selectedGroup.name}`,
      `예상 수량: ${quantity}`,
      `관심 상품: ${form.products.trim() || "미정"}`,
      `희망 일정: ${form.date || "미정"}`,
      `요청 사항: ${form.details.trim() || "없음"}`,
    ].join("\n");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "support",
          payload: {
            subject: "단체복·대량구매 상담",
            name: form.name.trim(),
            phone: form.phone.trim(),
            company: form.organization.trim(),
            purpose,
            group: selectedGroup.name,
            quantity,
            desiredDate: form.date,
            productName: form.products.trim(),
            privacyAgree: "yes",
            message: details,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "문의 접수에 실패했습니다.");
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "문의 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="team-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>WORKUP / GROUP & BULK ORDER</p>
            <h1 id="team-title">함께하는 순간,<br /><em>같은 옷</em>이 필요할 때.</h1>
            <p className={styles.heroLead}>러닝크루의 첫 단체 티셔츠부터 행사용 유니폼, 기업의 대량구매까지. 어떤 모임이든 필요한 옷을 함께 찾아드립니다.</p>
            <div className={styles.heroButtons}>
              <a href="#team-inquiry" className={styles.primaryButton}>단체 상담 시작하기 <span aria-hidden>↗</span></a>
              <a href="#ways" className={styles.secondaryButton}>구매 방식 살펴보기 <span aria-hidden>↓</span></a>
            </div>
          </div>
          <div className={styles.heroVisual} aria-label="다양한 단체를 상징하는 그래픽">
            <div className={styles.visualRing}><span>ONE TEAM</span><span>WORKUP</span></div>
            <div className={`${styles.visualTile} ${styles.tileOne}`}><small>01 / MOVE</small><strong>RUN<br />TOGETHER.</strong><span>러닝크루</span></div>
            <div className={`${styles.visualTile} ${styles.tileTwo}`}><small>02 / GATHER</small><strong>SHOW<br />UP.</strong><span>모임 · 행사</span></div>
            <div className={`${styles.visualTile} ${styles.tileThree}`}><small>03 / WORK</small><strong>MAKE<br />IT HAPPEN.</strong><span>기업 · 팀</span></div>
            <div className={styles.visualNumber}>01—06</div>
          </div>
        </div>
        <div className={styles.heroBottom}><span>TEAMWEAR / BULK PURCHASE</span><span>스크롤하여 알아보기 ↓</span></div>
      </section>

      <nav className={styles.anchorNav} aria-label="페이지 메뉴"><a href="#who">어떤 단체든</a><a href="#ways">구매 방식</a><a href="#process">진행 방법</a><a href="#team-inquiry">상담 문의</a></nav>

      <section id="who" className={`${styles.section} ${styles.audienceSection}`} aria-labelledby="who-title">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><p className={styles.sectionIndex}>01 / WHO WE WORK WITH</p><h2 id="who-title">단체의 모습은<br />하나가 아니니까.</h2><p>인원이나 활동이 달라도 괜찮습니다. 우리 팀이 어떤 옷을 필요로 하는지부터 시작해 보세요.</p></div>
          <div className={styles.groupGrid}>{groups.map((item, index) => <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => setGroup(item.id)} className={`${styles.groupCard} ${group === item.id ? styles.groupSelected : ""}`}><span className={styles.groupTop}><span>{String(index + 1).padStart(2, "0")}</span><span aria-hidden>{item.symbol}</span></span><strong>{item.name}</strong><span className={styles.groupCaption}>{item.caption}</span><span className={styles.groupArrow} aria-hidden>↗</span></button>)}</div>
          <p className={styles.sectionFootnote}>카드를 선택하면 아래 상담 내용에 단체 유형이 반영됩니다.</p>
        </div>
      </section>

      <section id="ways" className={`${styles.section} ${styles.waysSection}`} aria-labelledby="ways-title"><div className={styles.container}>
        <div className={styles.sectionHeading}><p className={styles.sectionIndex}>02 / TWO WAYS TO START</p><h2 id="ways-title">원하는 방식으로<br />시작하세요.</h2><p>단체의 이름을 담을 수도 있고, 필요한 상품을 여러 벌 준비할 수도 있습니다.</p></div>
        <div className={styles.wayGrid}>
          <article className={styles.wayCard}><div className={styles.wayArt}><span className={styles.wayArtNumber}>01</span><div className={styles.shirt} aria-hidden><span>YOUR<br />TEAM</span></div></div><div className={styles.wayCopy}><p>TEAMWEAR</p><h3>맞춤 단체복</h3><span>크루명·로고·이름처럼 팀을 드러내고 싶다면</span><ul><li>용도에 맞는 상품 함께 찾기</li><li>로고·문구 적용 가능 여부 확인</li><li>수량과 일정에 맞춘 상담</li></ul><button type="button" onClick={() => { setPurpose("uniform"); document.getElementById("team-inquiry")?.scrollIntoView({ behavior: "smooth" }); }}>단체복 상담하기 <span aria-hidden>↗</span></button></div></article>
          <article className={styles.wayCard}><div className={`${styles.wayArt} ${styles.bulkArt}`}><span className={styles.wayArtNumber}>02</span><div className={styles.stack} aria-hidden><i /><i /><i /></div></div><div className={styles.wayCopy}><p>BULK PURCHASE</p><h3>기성 상품 대량구매</h3><span>같은 제품을 여러 명에게 준비하고 싶다면</span><ul><li>기존 상품의 수량·재고 확인</li><li>색상과 사이즈 구성 상담</li><li>견적과 가능한 일정 안내</li></ul><button type="button" onClick={() => { setPurpose("bulk"); document.getElementById("team-inquiry")?.scrollIntoView({ behavior: "smooth" }); }}>대량구매 상담하기 <span aria-hidden>↗</span></button></div></article>
        </div>
        <div className={styles.catalogCallout}><div><strong>어떤 상품이 있는지 먼저 보고 싶나요?</strong><span>카탈로그에서 마음에 드는 제품을 살펴본 뒤 상품명을 알려주세요.</span></div><Link href="/products">전체 제품 보기 <span aria-hidden>↗</span></Link></div>
      </div></section>

      <section id="process" className={`${styles.section} ${styles.processSection}`} aria-labelledby="process-title"><div className={styles.container}><div className={styles.sectionHeading}><p className={styles.sectionIndex}>03 / HOW IT WORKS</p><h2 id="process-title">막연해도 괜찮아요.<br />이렇게 시작하면 됩니다.</h2></div><div className={styles.steps}>{[{ n: "01", title: "단체와 용도", text: "어떤 모임에서, 언제 입을 옷인지 알려주세요." }, { n: "02", title: "상품과 수량", text: "관심 상품과 예상 수량을 알려주세요. 미정이어도 괜찮습니다." }, { n: "03", title: "옵션 확인", text: "로고 작업이나 사이즈 구성이 필요하면 함께 확인합니다." }, { n: "04", title: "견적과 일정", text: "가능한 상품, 견적과 일정을 상담 후 안내합니다." }].map((step) => <div key={step.n}><span>{step.n}</span><h3>{step.title}</h3><p>{step.text}</p></div>)}</div><p className={styles.caution}>상품별 공급·로고 작업 가능 여부와 최종 금액, 납기는 상담 과정에서 확인됩니다.</p></div></section>

      <section className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-title"><div className={`${styles.container} ${styles.faqLayout}`}><div className={styles.sectionHeading}><p className={styles.sectionIndex}>04 / FAQ</p><h2 id="faq-title">궁금한 점을<br />먼저 확인하세요.</h2></div><div className={styles.faqList}>{faqs.map((item) => <details key={item.question}><summary>{item.question}<span aria-hidden>＋</span></summary><p>{item.answer}</p></details>)}</div></div></section>

      <section id="team-inquiry" className={`${styles.section} ${styles.inquirySection}`} aria-labelledby="inquiry-title"><div className={`${styles.container} ${styles.inquiryGrid}`}><div className={styles.inquiryCopy}><p className={styles.sectionIndex}>05 / START A CONVERSATION</p><h2 id="inquiry-title">우리 팀의 옷,<br />이야기해 주세요.</h2><p>정해진 내용만 적어도 됩니다. 필요한 상품과 가능 여부를 함께 확인해 드립니다.</p><div className={styles.selection}><span>현재 선택한 내용</span><strong>{purpose === "uniform" ? "맞춤 단체복" : "기성 상품 대량구매"} / {selectedGroup.name}</strong><small>예상 수량: {quantity}</small></div><Link href="/store" className={styles.storeLink}>직접 보고 싶다면 가까운 매장 찾기 ↗</Link></div><div className={styles.formCard}>{submitted ? <div className={styles.success} role="status"><span>✓</span><h3>{isLocalPreview ? "로컬 시안을 확인했습니다." : "문의가 접수되었습니다."}</h3><p>{isLocalPreview ? "미리보기에서는 문의가 저장되지 않습니다." : "남겨주신 연락처로 상담을 이어가겠습니다."}</p><button type="button" onClick={() => setSubmitted(false)}>다시 작성하기</button></div> : <form onSubmit={submit}>
        <fieldset className={styles.fieldset}><legend>어떤 상담이 필요하신가요?</legend><div className={styles.choiceRow}><button type="button" aria-pressed={purpose === "uniform"} onClick={() => setPurpose("uniform")}>맞춤 단체복</button><button type="button" aria-pressed={purpose === "bulk"} onClick={() => setPurpose("bulk")}>기성 상품 대량구매</button></div></fieldset>
        <div className={styles.formRow}><label>단체 유형<select value={group} onChange={(event) => setGroup(event.target.value as Group)}>{groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>예상 수량<select value={quantity} onChange={(event) => setQuantity(event.target.value)}>{quantities.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <div className={styles.formRow}><label>단체명 <span>(선택)</span><input value={form.organization} onChange={(event) => setForm({ ...form, organization: event.target.value })} placeholder="단체 또는 회사 이름" autoComplete="organization" maxLength={80} /></label><label>희망 일정 <span>(선택)</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div>
        <div className={styles.formRow}><label>담당자명 <em>*</em><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="이름" autoComplete="name" maxLength={40} required /></label><label>연락처 <em>*</em><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="010-0000-0000" autoComplete="tel" minLength={8} maxLength={20} required /></label></div>
        <label>관심 상품 <span>(선택)</span><input value={form.products} onChange={(event) => setForm({ ...form, products: event.target.value })} placeholder="예: 반팔 티셔츠, 윈드자켓, 조끼" maxLength={200} /></label>
        <label>추가 요청 <span>(선택)</span><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="용도, 색상, 사이즈 구성, 로고 작업 등 필요한 내용을 적어 주세요." rows={4} maxLength={1500} /></label>
        <label className={styles.privacy}><input type="checkbox" checked={form.privacy} onChange={(event) => setForm({ ...form, privacy: event.target.checked })} required /><span><strong>[필수]</strong> 문의 접수와 상담을 위한 개인정보 수집·이용에 동의합니다. <Link href="/privacy" target="_blank">내용 보기</Link></span></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.submit} type="submit" disabled={submitting}>{submitting ? "접수 중…" : isLocalPreview ? "문의 화면 확인하기 (로컬 시안)" : "상담 문의 보내기"}<span aria-hidden>↗</span></button>
      </form>}</div></div></section>
      <div className={styles.mobileCta}><a href="#team-inquiry">단체 상담 시작하기 ↗</a></div>
    </main>
  );
}
