"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./group-order.module.css";

export type Industry = "site" | "logistics" | "service";
export type GroupProduct = { id: string; name: string; price: string; imageUrl: string };

const industries: { id: Industry; label: string; detail: string; title: string }[] = [
  { id: "site", label: "건설·제조", detail: "움직임이 많고 수납이 필요한 현장", title: "현장에서 함께 입을 옷" },
  { id: "logistics", label: "물류·배송", detail: "실내외를 오가며 일하는 팀", title: "이동이 많은 팀의 옷" },
  { id: "service", label: "매장·서비스", detail: "고객을 마주하는 팀의 옷", title: "매장의 인상을 만드는 옷" },
];
const quantities = ["10벌 미만", "10~49벌", "50~99벌", "100벌 이상", "아직 미정"];
const priorities = ["활동성", "기능", "통일감", "예산"];
const logoPositions = [
  { id: "chest", label: "가슴" },
  { id: "back", label: "등판" },
  { id: "sleeve", label: "소매" },
] as const;
type LogoPosition = (typeof logoPositions)[number]["id"];

const faqs = [
  { q: "몇 벌부터 문의할 수 있나요?", a: "필요한 수량을 알려주시면 제품별 공급 가능 여부를 확인해 안내합니다. 수량이 아직 정해지지 않아도 상담할 수 있습니다." },
  { q: "사이즈를 섞어서 주문할 수 있나요?", a: "제품별 사이즈와 재고 상황이 달라 수량을 확인한 뒤 안내합니다. 필요한 사이즈가 정해져 있다면 문의 내용에 적어 주세요." },
  { q: "회사 로고를 넣을 수 있나요?", a: "제품과 로고 작업 방식에 따라 가능 여부가 다릅니다. 원하는 위치와 로고 파일 유무를 알려주시면 확인해 안내합니다." },
  { q: "언제 받을 수 있나요?", a: "제품, 수량, 로고 작업, 납품 지역에 따라 일정이 달라집니다. 희망 날짜를 남겨주시면 가능한 일정을 확인합니다." },
];

function LogoPreview({ position }: { position: LogoPosition }) {
  return (
    <div className={styles.logoPreview} aria-label={`로고 ${logoPositions.find((item) => item.id === position)?.label} 배치 예시`}>
      <svg className={styles.garmentDiagram} viewBox="0 0 720 360" role="img" aria-label="작업복 앞면과 뒷면을 단순화한 그림">
        <path d="M126 52 178 33 221 63 264 33 316 52 354 118 319 139 302 107 302 332 139 332 139 107 122 139 87 118Z" fill="#e9eae7" stroke="#adb2ae" strokeWidth="3" />
        <path d="M178 33 221 63 264 33 250 80 221 96 192 80Z" fill="#f8f8f6" stroke="#adb2ae" strokeWidth="3" />
        <path d="M221 96V332M159 145h41v34h-41zM242 145h41v34h-41z" fill="none" stroke="#b8bcb8" strokeWidth="2" />
        <path d="M453 52 505 33 548 52 591 33 643 52 681 118 646 139 629 107 629 332 466 332 466 107 449 139 414 118Z" fill="#dadcd8" stroke="#adb2ae" strokeWidth="3" />
        <path d="M505 33q43 40 86 0" fill="none" stroke="#adb2ae" strokeWidth="3" />
        <path d="M485 115h125" fill="none" stroke="#b8bcb8" strokeWidth="2" />
      </svg>
      <span className={`${styles.logoMarker} ${styles[position]}`}>로고</span>
      <span className={styles.frontLabel}>앞면</span>
      <span className={styles.backLabel}>뒷면</span>
    </div>
  );
}

export default function GroupOrderPage({ products }: { products: Record<Industry, GroupProduct[]> }) {
  const isLocalPreview = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_VERCEL_ENV === "preview";
  const [industry, setIndustry] = useState<Industry>("site");
  const [quantity, setQuantity] = useState("아직 미정");
  const [priority, setPriority] = useState("활동성");
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("chest");
  const [selectedProduct, setSelectedProduct] = useState<GroupProduct | null>(null);
  const [form, setForm] = useState({ company: "", name: "", phone: "", desiredDate: "", message: "", privacyAgree: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const currentIndustry = industries.find((item) => item.id === industry)!;

  const chooseProduct = (product: GroupProduct) => {
    setSelectedProduct(product);
    document.getElementById("group-inquiry")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitInquiry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.privacyAgree) {
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
      `업종: ${currentIndustry.label}`,
      `예상 수량: ${quantity}`,
      `중요 조건: ${priority}`,
      `관심 상품: ${selectedProduct?.name ?? "미정"}`,
      `희망 로고 위치(예시): ${logoPositions.find((item) => item.id === logoPosition)?.label}`,
      `희망 납품일: ${form.desiredDate || "미정"}`,
      `추가 요청: ${form.message.trim() || "없음"}`,
    ].join("\n");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "support",
          payload: {
            subject: "단체복·대량구매",
            name: form.name.trim(),
            phone: form.phone.trim(),
            company: form.company.trim(),
            industry: currentIndustry.label,
            quantity,
            priority,
            productId: selectedProduct?.id ?? "",
            productName: selectedProduct?.name ?? "",
            desiredDate: form.desiredDate,
            logoPosition,
            privacyAgree: "yes",
            message: details,
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
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="group-order-heading">
        <Image src="/images/group-order-hero.webp" alt="작업 현장에서 함께 일하는 세 사람의 연출 이미지" fill priority sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={styles.heroKicker}>WORKUP / 단체복·대량구매</p>
          <h1 id="group-order-heading">함께 입을 옷,<br />우리 일에 맞게.</h1>
          <p className={styles.heroDescription}>팀의 일과 움직임에 맞는 옷을 살펴보세요.<br />수량부터 로고 계획까지, 필요한 내용을 모아 상담할 수 있습니다.</p>
          <div className={styles.heroActions}>
            <a href="#group-finder" className={styles.primaryButton}>우리 팀 단체복 찾아보기 <span aria-hidden>↗</span></a>
            <a href="#group-inquiry" className={styles.ghostButton}>바로 견적 문의</a>
          </div>
        </div>
        <span className={styles.imageNote}>연출 이미지 · 실제 상품은 아래에서 확인</span>
      </section>

      <nav className={styles.anchorNav} aria-label="단체복 페이지 메뉴">
        <a href="#group-finder">팀에 맞는 옷 찾기</a>
        <a href="#group-logo">로고 위치 보기</a>
        <a href="#group-guide">주문 안내</a>
        <a href="#group-inquiry">견적 문의</a>
      </nav>

      <section id="group-finder" className={`${styles.section} ${styles.finderSection}`} aria-labelledby="finder-heading">
        <div className={styles.container}>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionLabel}>01 / 찾아보기</p>
            <h2 id="finder-heading">우리 팀은 어떤 옷이 필요할까요?</h2>
            <p>업종에 맞춰 참고할 제품을 보여드립니다. 수량과 중요한 조건은 견적 문의에 함께 담깁니다.</p>
          </div>
          <div className={styles.finderPanel}>
            <div className={styles.finderRow}>
              <div className={styles.finderQuestion}><span>1</span><h3>어떤 팀이 입나요?</h3></div>
              <div className={styles.industryOptions}>
                {industries.map((item) => (
                  <button key={item.id} type="button" aria-pressed={industry === item.id} onClick={() => { setIndustry(item.id); setSelectedProduct(null); }} className={`${styles.industryOption} ${industry === item.id ? styles.selected : ""}`}>
                    <strong>{item.label}</strong><span>{item.detail}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.finderRow}>
              <div className={styles.finderQuestion}><span>2</span><h3>몇 벌 정도 필요하신가요?</h3></div>
              <div className={styles.chipOptions}>{quantities.map((item) => <button key={item} type="button" aria-pressed={quantity === item} onClick={() => setQuantity(item)} className={`${styles.chip} ${quantity === item ? styles.selectedChip : ""}`}>{item}</button>)}</div>
            </div>
            <div className={styles.finderRow}>
              <div className={styles.finderQuestion}><span>3</span><h3>가장 중요한 조건은요?</h3></div>
              <div className={styles.chipOptions}>{priorities.map((item) => <button key={item} type="button" aria-pressed={priority === item} onClick={() => setPriority(item)} className={`${styles.chip} ${priority === item ? styles.selectedChip : ""}`}>{item}</button>)}</div>
            </div>
          </div>

          <div className={styles.results} aria-live="polite">
            <div className={styles.resultsHead}>
              <div><p className={styles.sectionLabel}>살펴볼 제품</p><h3>{currentIndustry.title}</h3><p>표시된 가격은 제품 정보용입니다. 단체 견적과 로고 작업 가능 여부는 상담 시 확인합니다.</p></div>
              <Link href="/products" className={styles.textLink}>전체 제품 보기 <span aria-hidden>↗</span></Link>
            </div>
            {products[industry].length > 0 ? (
              <div className={styles.productGrid}>
                {products[industry].map((product) => (
                  <article key={product.id} className={styles.productCard}>
                    <Link href={`/products/${encodeURIComponent(product.id)}`} className={styles.productImageLink} aria-label={`${product.name} 제품 정보 보기`}>
                      <Image src={product.imageUrl} alt={product.name} width={560} height={580} unoptimized className={styles.productImage} />
                    </Link>
                    <div className={styles.productCopy}>
                      <h4>{product.name}</h4>
                      {product.price && <p className={styles.productPrice}>제품 표시가 {product.price}</p>}
                      <div className={styles.productActions}>
                        <Link href={`/products/${encodeURIComponent(product.id)}`}>제품 보기</Link>
                        <button type="button" onClick={() => chooseProduct(product)}>이 제품 문의하기 <span aria-hidden>↗</span></button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.productEmpty}><p>선택한 업종의 참고 상품을 불러오지 못했습니다.</p><Link href="/products">전체 제품에서 살펴보기</Link></div>
            )}
          </div>
        </div>
      </section>

      <section id="group-logo" className={`${styles.section} ${styles.logoSection}`} aria-labelledby="logo-heading">
        <div className={`${styles.container} ${styles.logoLayout}`}>
          <div className={styles.logoCopy}>
            <p className={styles.sectionLabel}>02 / 로고 계획</p>
            <h2 id="logo-heading">로고는 어디에<br />두고 싶으신가요?</h2>
            <p>위치를 골라 배치 느낌을 살펴보세요. 제품과 작업 방식에 따라 실제 적용 가능 위치는 달라질 수 있습니다.</p>
            <div className={styles.logoButtons} role="group" aria-label="로고 위치 예시 선택">
              {logoPositions.map((item) => <button key={item.id} type="button" aria-pressed={logoPosition === item.id} onClick={() => setLogoPosition(item.id)} className={logoPosition === item.id ? styles.activeLogoButton : ""}>{item.label}</button>)}
            </div>
            <p className={styles.exampleNote}>위 그림은 상담을 돕기 위한 배치 예시입니다. 제작 시안이나 확정 사양이 아닙니다.</p>
          </div>
          <LogoPreview position={logoPosition} />
        </div>
      </section>

      <section id="group-guide" className={`${styles.section} ${styles.guideSection}`} aria-labelledby="guide-heading">
        <div className={styles.container}>
          <div className={styles.sectionIntro}><p className={styles.sectionLabel}>03 / 주문 안내</p><h2 id="guide-heading">견적 전에 확인할 것</h2><p>정확한 금액과 일정은 제품과 수량, 작업 내용을 확인한 뒤 안내합니다.</p></div>
          <div className={styles.factorGrid}>
            <div><span>제품과 수량</span><p>어떤 옷을 몇 벌 준비할지 알려주세요. 사이즈가 정해졌다면 함께 적어주시면 좋습니다.</p></div>
            <div><span>로고 작업</span><p>로고가 필요한지, 원하는 위치가 있는지 알려주세요. 제품별 가능 여부를 확인합니다.</p></div>
            <div><span>희망 일정</span><p>필요한 날짜와 지역을 알려주세요. 수량과 작업 내용에 맞춰 일정을 확인합니다.</p></div>
          </div>
          <div className={styles.process}>
            {["제품·수량 전달", "옵션과 재고 확인", "견적·일정 안내", "상담 후 진행 결정"].map((step, index) => <div key={step}><strong>{String(index + 1).padStart(2, "0")}</strong><span>{step}</span></div>)}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.visitSection}`} aria-labelledby="visit-heading">
        <div className={styles.visitImage} role="img" aria-label="워크웨어가 진열된 매장 연출 사진" />
        <div className={styles.visitContent}><p className={styles.sectionLabel}>실물 확인</p><h2 id="visit-heading">옷은 직접 보고<br />고르면 더 확실하니까요.</h2><p>소재와 착용감을 확인하고 싶다면 가까운 WORKUP 매장을 찾아보세요. 방문 전 원하는 제품의 취급 여부를 매장에 문의해 주세요.</p><Link href="/store" className={styles.darkButton}>가까운 매장 찾기 <span aria-hidden>↗</span></Link></div>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`} aria-labelledby="faq-heading"><div className={`${styles.container} ${styles.faqLayout}`}><div><p className={styles.sectionLabel}>04 / 자주 묻는 질문</p><h2 id="faq-heading">궁금한 점부터<br />확인하세요.</h2></div><div className={styles.faqList}>{faqs.map((item) => <details key={item.q}><summary>{item.q}<span aria-hidden>+</span></summary><p>{item.a}</p></details>)}</div></div></section>

      <section id="group-inquiry" className={`${styles.section} ${styles.inquirySection}`} aria-labelledby="inquiry-heading"><div className={`${styles.container} ${styles.inquiryLayout}`}><div className={styles.inquiryIntro}><p className={styles.sectionLabel}>05 / 견적 문의</p><h2 id="inquiry-heading">팀에 필요한 옷을<br />함께 찾아보겠습니다.</h2><p>아는 내용만 먼저 남겨주세요. 제품·수량·로고 계획을 확인해 상담을 이어갑니다.</p><div className={styles.selectionSummary}><span>현재 선택</span><p>{currentIndustry.label} · {quantity} · {priority}</p><p>{selectedProduct ? selectedProduct.name : "관심 상품 미정"} · 로고 {logoPositions.find((item) => item.id === logoPosition)?.label} 예시</p></div></div>
        <div className={styles.formCard}>
          {submitted ? <div className={styles.success} role="status"><span aria-hidden>✓</span><h3>{isLocalPreview ? "검토용 시안을 확인했습니다." : "문의가 접수되었습니다."}</h3><p>{isLocalPreview ? "미리보기에서는 문의가 저장되지 않습니다." : "남겨주신 연락처로 상담을 이어가겠습니다."}</p><button type="button" onClick={() => setSubmitted(false)}>다시 문의하기</button></div> : (
            <form onSubmit={submitInquiry}>
              <div className={styles.formGrid}>
                <label>회사·단체명 <span>(선택)</span><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" placeholder="회사 또는 단체 이름" maxLength={80} /></label>
                <label>담당자명 <em>*</em><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" placeholder="이름" maxLength={40} required /></label>
                <label>연락처 <em>*</em><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" placeholder="010-0000-0000" minLength={8} maxLength={20} required /></label>
                <label>희망 납품일 <span>(선택)</span><input type="date" value={form.desiredDate} onChange={(e) => setForm({ ...form, desiredDate: e.target.value })} /></label>
              </div>
              <label className={styles.messageLabel}>추가 요청 <span>(선택)</span><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="원하는 상품, 색상, 사이즈, 로고 작업 계획 등을 적어 주세요." rows={4} maxLength={1500} /></label>
              <label className={styles.privacyLabel}><input type="checkbox" checked={form.privacyAgree} onChange={(e) => setForm({ ...form, privacyAgree: e.target.checked })} required /><span><strong>[필수]</strong> 문의 접수와 상담을 위한 개인정보 수집·이용에 동의합니다. <Link href="/privacy" target="_blank">내용 보기</Link></span></label>
              {error && <p className={styles.formError} role="alert">{error}</p>}
              <button type="submit" disabled={submitting} className={styles.submitButton}>{submitting ? "접수 중…" : isLocalPreview ? "문의 화면 확인하기 (검토용 시안)" : "선택한 내용으로 견적 문의"}<span aria-hidden>↗</span></button>
            </form>
          )}
        </div>
      </div></section>

      <div className={styles.mobileCta}><a href="#group-inquiry">견적 문의하기 <span aria-hidden>↗</span></a></div>
    </main>
  );
}
