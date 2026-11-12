"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import PrivacyConsentModal from "@/components/PrivacyConsentModal";
import styles from "./group-order.module.css";

// 접수 방식: live = 운영 접수(/api/inquiries), mock = 로컬·Preview용 모의 응답(운영 접수처로 전송하지 않음)
type SubmitMode = "live" | "mock";
type InquiryType = "logo_print" | "bulk_purchase";
type FieldKey = "organization" | "contact" | "phone" | "email" | "quantity" | "agree";
type Errors = Partial<Record<FieldKey, string>>;
type Values = { organization: string; contact: string; phone: string; email: string; quantity: string; product: string; requiredDate: string; message: string };

const EMPTY_VALUES: Values = { organization: "", contact: "", phone: "", email: "", quantity: "", product: "", requiredDate: "", message: "" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNDECIDED = "미정"; // 필요한 날짜를 정하지 못한 경우 저장하는 값
const FAIL_MESSAGE = "문의가 접수되지 않았습니다. 잠시 후 다시 시도해 주세요.";
// 오류가 있을 때 첫 오류 항목으로 포커스를 옮기는 순서(화면 순서와 동일)
const FIELD_ORDER: { key: FieldKey; id: string }[] = [
  { key: "organization", id: "go-organization" },
  { key: "contact", id: "go-contact" },
  { key: "phone", id: "go-phone" },
  { key: "email", id: "go-email" },
  { key: "quantity", id: "go-quantity" },
  { key: "agree", id: "go-agree" },
];

const MESSAGE_PLACEHOLDER: Record<InquiryType | "none", string> = {
  none: "사용 목적, 예산, 색상·사이즈 등을 남겨주세요.",
  bulk_purchase: "사용 목적, 예산, 색상·사이즈 등을 남겨주세요.",
  logo_print: "로고 작업 위치, 인쇄·자수 희망 여부 등을 남겨주세요. 자세한 내용은 상담 후 결정하셔도 됩니다.",
};

function ShirtIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4 4 8l2.5 6L10 12.5V28h12V12.5l3.5 1.5L28 8l-7-4a5 5 0 0 1-10 0Z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 3 11 6v14l-11 6-11-6V9l11-6Z" />
      <path d="M5 9l11 6 11-6M16 15v14M10.5 6l11 6" />
    </svg>
  );
}

const TYPES: { value: InquiryType; title: string; desc: string; label: string; icon: ReactNode }[] = [
  { value: "logo_print", title: "로고·인쇄 단체복", desc: "워크업 상품에 우리 회사·단체의 로고를 더하고 싶어요.", label: "로고·인쇄", icon: <ShirtIcon /> },
  { value: "bulk_purchase", title: "기성복 대량구매", desc: "추가 작업 없이 필요한 상품을 여러 벌 구매하고 싶어요.", label: "기성복 대량구매", icon: <PackageIcon /> },
];

const STEPS = [
  { no: "01", title: "문의 접수", desc: "필요한 상품과 수량을 남겨주세요." },
  { no: "02", title: "조건 확인", desc: "상품·재고와 추가 작업 가능 여부를 확인합니다." },
  { no: "03", title: "견적 안내", desc: "구매 견적과 진행 일정을 안내합니다." },
];

// 숫자만 입력해도 하이픈을 자동으로 넣는다. 휴대폰(010-0000-0000)과 지역번호 일반 전화(02-000-0000, 031-000-0000),
// 대표번호(1588-0000)를 지원하고, 해외번호(+로 시작)는 손대지 않는다.
function formatPhone(raw: string): string {
  if (raw.trim().startsWith("+")) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (/^1[5-8]/.test(d)) return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  const area = d.startsWith("02") ? 2 : 3;
  if (d.length <= area) return d;
  const rest = d.slice(area);
  if (rest.length <= 3) return `${d.slice(0, area)}-${rest}`;
  const mid = rest.length >= 8 ? 4 : 3; // 가운데 자리: 8자리 국번+번호면 4자리, 7자리 이하면 3자리
  return `${d.slice(0, area)}-${rest.slice(0, mid)}-${rest.slice(mid)}`;
}

// 휴대폰·지역번호 일반 전화 모두 허용(공백·하이픈 허용). 실제 번호 소유 확인이 아니라 형식만 확인한다.
function isPhoneValid(raw: string): boolean {
  const value = raw.trim();
  if (!/^[0-9+\-()\s]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 8 && digits <= 15;
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? <span className={styles.req} aria-hidden="true"> *</span> : <span className={styles.opt}>선택</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className={styles.error}>{error}</p>}
    </div>
  );
}

export default function GroupOrderPage({ submitMode }: { submitMode: SubmitMode }) {
  const [type, setType] = useState<InquiryType | null>(null);
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [consentOpen, setConsentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const submittingRef = useRef(false); // 상태 반영 전 연속 클릭까지 막는 즉시 잠금
  const consentButtonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const typeMeta = TYPES.find((t) => t.value === type);
  const dateUndecided = values.requiredDate === UNDECIDED;
  // 지난 날짜는 고를 수 없게 오늘을 최소값으로 둔다(서버·브라우저 날짜 차이로 인한 불일치를 피하려고 마운트 후 계산).
  const [today, setToday] = useState<string | undefined>(undefined);
  useEffect(() => {
    const now = new Date();
    setToday(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  }, []);

  // 폼이 완료 안내로 바뀌므로 화면 위치와 스크린리더 포커스를 완료 문구로 옮긴다.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const setValue = (key: keyof Values) => (event: { target: { value: string } }) => {
    const next = event.target.value;
    setValues((prev) => ({ ...prev, [key]: next }));
    // 입력을 고치기 시작하면 해당 항목의 오류 표시를 지운다(선택 항목은 오류가 없으므로 영향 없음).
    setErrors((prev) => (prev[key as FieldKey] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!values.organization.trim()) next.organization = "회사 / 단체명을 입력해 주세요.";
    if (!values.contact.trim()) next.contact = "담당자명을 입력해 주세요.";
    if (!values.phone.trim()) next.phone = "연락처를 입력해 주세요.";
    else if (!isPhoneValid(values.phone)) next.phone = "연락 가능한 전화번호를 확인해 주세요.";
    // 이메일은 선택 — 입력했다면 형식만 확인한다.
    if (values.email.trim() && !EMAIL_RE.test(values.email.trim())) next.email = "이메일 주소를 확인해 주세요.";
    if (!values.quantity.trim()) next.quantity = "예상 수량을 입력해 주세요. (‘미정’도 가능)";
    if (!agree) next.agree = "개인정보 수집·이용에 동의해 주세요.";
    return next;
  };

  const send = async (): Promise<boolean> => {
    if (submitMode === "mock") {
      // 보고용 확인 편의: 주소 끝에 ?mock=fail 을 붙이면 실패 화면을 확인할 수 있다.
      await new Promise((resolve) => setTimeout(resolve, 700));
      return new URLSearchParams(window.location.search).get("mock") !== "fail";
    }
    const inquiryType = type ?? "unspecified";
    const typeLabel = typeMeta?.label ?? "유형 미선택";
    const organization = values.organization.trim();
    const none = "미입력";
    // 기존 문의 관리 화면(고객 1:1)에서 그대로 보이도록 제목·본문에 구조화해 담는다.
    const message = [
      `문의 유형: ${typeLabel}`,
      `회사·단체명: ${organization}`,
      `담당자: ${values.contact.trim()}`,
      `연락처: ${values.phone.trim()}`,
      `이메일: ${values.email.trim() || none}`,
      `예상 수량: ${values.quantity.trim()}`,
      `희망 상품: ${values.product.trim() || none}`,
      `필요한 날짜: ${values.requiredDate.trim() || none}`,
      `추가 요청사항: ${values.message.trim() || none}`,
    ].join("\n");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "group_order",
          payload: {
            subject: `[단체복·대량구매 / ${typeLabel}] ${organization}`,
            inquiry_type: inquiryType,
            organization_name: organization,
            name: values.contact.trim(),
            phone: values.phone.trim(),
            email: values.email.trim(),
            quantity_text: values.quantity.trim(),
            product_text: values.product.trim(),
            required_date_text: values.requiredDate.trim(),
            message,
            privacyAgree: "동의",
          },
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    const firstError = FIELD_ORDER.find(({ key }) => nextErrors[key]);
    if (firstError) {
      setFailed(false);
      document.getElementById(firstError.id)?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFailed(false);
    const ok = await send();
    submittingRef.current = false;
    setSubmitting(false);
    if (ok) {
      setDone(true);
    } else {
      setFailed(true); // 입력값·유형·동의 상태는 그대로 유지
    }
  };

  const resetPreview = () => {
    setType(null);
    setValues(EMPTY_VALUES);
    setAgree(false);
    setErrors({});
    setFailed(false);
    setDone(false);
  };

  const describedBy = (key: FieldKey, id: string) => (errors[key] ? `${id}-error` : undefined);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.layout}>
        {/* PC 좌측 이미지 — 순수 비주얼(글자는 HTML로만 표시). 모바일은 입력에 집중하도록 숨긴다. */}
        <aside className={styles.visual} aria-hidden="true">
          <div className={styles.visualFrame}>
            <div className={styles.visualPhoto}>
              <Image
                src="/images/group-order-team.webp" alt="" fill sizes="(min-width: 960px) 55vw, 0px"
                className={styles.visualImage}
              />
            </div>
          </div>
        </aside>

        <div className={styles.content}>
        {/* A. 메인 안내 */}
        <header className={styles.intro}>
          <h1 className={styles.title}>단체복·대량구매, 워크업에서 한 번에.</h1>
          <p className={styles.lead}>
            <span>기업 유니폼부터 행사복, 동호회 단체복까지.</span>
            <span>필요한 상품과 수량을 남겨주시면 구매 방법과 견적을 안내해 드립니다.</span>
          </p>
        </header>

        {/* B. 문의 유형 카드 — 선택사항, 한 번에 하나만 선택 */}
        <fieldset className={styles.types}>
          <legend className={styles.srOnly}>문의 유형 (선택)</legend>
          {TYPES.map((item) => {
            const selected = type === item.value;
            return (
              <label key={item.value} className={`${styles.card} ${selected ? styles.cardSelected : ""}`}>
                <input
                  type="radio"
                  name="inquiry_type"
                  value={item.value}
                  checked={selected}
                  onChange={() => setType(item.value)}
                  className={styles.srOnly}
                />
                <span className={styles.cardIcon}>{item.icon}</span>
                <span className={styles.cardText}>
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                </span>
                <span className={styles.cardCheck} aria-hidden="true">{selected ? "✓ 선택됨" : ""}</span>
              </label>
            );
          })}
        </fieldset>

        {/* C·D. 문의폼 */}
        <section className={styles.formSection} aria-labelledby="go-form-title">
          {done ? (
            <div className={styles.done} role="status">
              <h2 id="go-form-title" ref={doneRef} tabIndex={-1}>견적 문의가 접수되었습니다.</h2>
              <p>
                <span>남겨주신 내용을 확인한 후</span>
                <span>입력하신 연락처로 안내해 드리겠습니다.</span>
              </p>
              {submitMode === "mock" && (
                <>
                  <p className={styles.previewNotice}>미리보기 화면입니다. 실제로 접수되지 않았습니다.</p>
                  <button type="button" className={styles.textButton} onClick={resetPreview}>폼 다시 보기</button>
                </>
              )}
            </div>
          ) : (
            <>
              <h2 id="go-form-title" className={styles.formTitle}>어떤 단체복이 필요하세요?</h2>
              <p className={styles.formLead}>
                <span>상품이나 수량이 확정되지 않아도 괜찮습니다.</span>
                <span>필요한 내용을 남겨주시면 확인 후 안내해 드립니다.</span>
              </p>
              <p className={styles.requiredNote}><span aria-hidden="true">*</span> 필수 입력</p>

              <form onSubmit={handleSubmit} noValidate className={styles.form}>
                <div className={styles.grid}>
                  <Field id="go-organization" label="회사 / 단체명" required error={errors.organization}>
                    <input
                      id="go-organization" type="text" autoComplete="organization" placeholder="회사명 또는 단체명" maxLength={100}
                      value={values.organization} onChange={setValue("organization")}
                      aria-required="true" aria-invalid={!!errors.organization} aria-describedby={describedBy("organization", "go-organization")}
                      className={styles.input}
                    />
                  </Field>
                  <Field id="go-contact" label="담당자명" required error={errors.contact}>
                    <input
                      id="go-contact" type="text" autoComplete="name" placeholder="성함" maxLength={50}
                      value={values.contact} onChange={setValue("contact")}
                      aria-required="true" aria-invalid={!!errors.contact} aria-describedby={describedBy("contact", "go-contact")}
                      className={styles.input}
                    />
                  </Field>
                  <Field id="go-phone" label="연락처" required error={errors.phone}>
                    <input
                      id="go-phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01046233306" maxLength={30}
                      value={values.phone} onChange={(event) => setValue("phone")({ target: { value: formatPhone(event.target.value) } })}
                      aria-required="true" aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", "go-phone")}
                      className={styles.input}
                    />
                  </Field>
                  <Field id="go-email" label="이메일" error={errors.email}>
                    <input
                      id="go-email" type="email" inputMode="email" autoComplete="email" placeholder="example@company.com" maxLength={100}
                      value={values.email} onChange={setValue("email")}
                      aria-invalid={!!errors.email} aria-describedby={describedBy("email", "go-email")}
                      className={styles.input}
                    />
                  </Field>
                  <Field id="go-quantity" label="예상 수량" required error={errors.quantity}>
                    <input
                      id="go-quantity" type="text" placeholder="예: 30벌 / 미정" maxLength={50}
                      value={values.quantity} onChange={setValue("quantity")}
                      aria-required="true" aria-invalid={!!errors.quantity} aria-describedby={describedBy("quantity", "go-quantity")}
                      className={styles.input}
                    />
                  </Field>
                  <Field id="go-date" label="필요한 날짜">
                    {/* 달력으로 날짜 선택. 정해지지 않았다면 '미정'을 체크한다(선택 항목이라 비워 둬도 된다). */}
                    <input
                      id="go-date" type="date" min={today}
                      value={dateUndecided ? "" : values.requiredDate} onChange={setValue("requiredDate")}
                      disabled={dateUndecided} className={styles.input}
                    />
                    <label className={styles.inlineCheck}>
                      <input
                        type="checkbox" checked={dateUndecided}
                        onChange={(event) => setValues((prev) => ({ ...prev, requiredDate: event.target.checked ? UNDECIDED : "" }))}
                      />
                      날짜 미정
                    </label>
                  </Field>
                  <div className={styles.fullRow}>
                    <Field id="go-product" label="희망 상품">
                      <input
                        id="go-product" type="text" placeholder="상품명·품번·상품 링크" maxLength={300}
                        value={values.product} onChange={setValue("product")} className={styles.input}
                      />
                    </Field>
                  </div>
                  <div className={styles.fullRow}>
                    <Field id="go-message" label="추가 요청사항">
                      <textarea
                        id="go-message" rows={5} maxLength={1500}
                        placeholder={MESSAGE_PLACEHOLDER[type ?? "none"]}
                        value={values.message} onChange={setValue("message")} className={`${styles.input} ${styles.textarea}`}
                      />
                    </Field>
                  </div>
                </div>

                {/* 개인정보 동의 */}
                <div className={styles.consent}>
                  <div className={styles.consentRow}>
                    <input
                      id="go-agree" type="checkbox" checked={agree}
                      onChange={(event) => { setAgree(event.target.checked); if (event.target.checked) setErrors((prev) => ({ ...prev, agree: undefined })); }}
                      aria-required="true" aria-invalid={!!errors.agree} aria-describedby={describedBy("agree", "go-agree")}
                      className={styles.checkbox}
                    />
                    <label htmlFor="go-agree">개인정보 수집·이용에 동의합니다. (필수)</label>
                    <button type="button" ref={consentButtonRef} className={styles.textButton} onClick={() => setConsentOpen(true)}>내용 보기</button>
                  </div>
                  {errors.agree && <p id="go-agree-error" className={styles.error}>{errors.agree}</p>}
                </div>

                {failed && <p className={styles.failBox} role="alert">{FAIL_MESSAGE}</p>}

                <button type="submit" className={styles.submit} disabled={submitting}>
                  {submitting ? "접수 중…" : "견적 문의하기"}
                </button>
              </form>
            </>
          )}
        </section>
        </div>
        </div>

        {/* E. 진행 안내 */}
        <section className={styles.process} aria-labelledby="go-process-title">
          <h2 id="go-process-title" className={styles.srOnly}>진행 안내</h2>
          <ol className={styles.steps}>
            {STEPS.map((step) => (
              <li key={step.no} className={styles.step}>
                <span className={styles.stepNo}>{step.no}</span>
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </li>
            ))}
          </ol>
          <p className={styles.processNote}>상품과 수량, 인쇄·자수 여부에 따라 견적과 납기가 달라질 수 있습니다.</p>
        </section>
      </div>

      {consentOpen && (
        <PrivacyConsentModal
          collectedItems="회사/단체명, 담당자명, 연락처, 이메일(선택), 문의 내용(예상 수량·희망 상품·필요한 날짜·추가 요청사항)"
          onClose={() => { setConsentOpen(false); requestAnimationFrame(() => consentButtonRef.current?.focus()); }}
        />
      )}
    </main>
  );
}
