import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MateActionForm from "@/components/MateActionForm";
import MateAddressField from "@/components/MateAddressField";
import MatePhoneInput from "@/components/MatePhoneInput";
import { isAdmin } from "@/lib/admin-auth";
import { MATE_APPLICATION_GENDERS, MATE_STYLES, formatMateDate, mateRoundStatus, parseRound } from "@/lib/mate";
import { listMateRounds, localMatePreview } from "@/lib/mate-server";
import { submitMateApplication } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "WORKUP MATE 모집",
  description: "워크업의 제품을 직접 경험하고 자신만의 콘텐츠로 WORKUP을 표현할 크리에이터를 모집합니다.",
};

const inputClass = "mt-2 min-h-11 w-full rounded-md border border-stone-400 bg-white px-3 py-2";
const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-md bg-[#ff6e32] px-6 py-3 font-black text-[#20140d] hover:bg-[#ff8c57] disabled:opacity-60";

export default async function MatePage({ params, searchParams }: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { path } = await params;
  const requested = path?.length === 1 ? parseRound(path[0]) : null;
  if (path?.length && !requested) notFound();

  const preview = (await searchParams).preview === "1" && await isAdmin();
  const { data, error } = await listMateRounds(requested, !preview);
  const rounds = data ?? [];
  const round = rounds.find((item) => mateRoundStatus(item) === "모집 중") ?? rounds[0];
  if (!error && !round && requested) notFound();
  if (!round) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20 text-[#20140d]">
        <h1 className="text-4xl font-black">WORKUP MATE</h1>
        <p className="mt-4">{error ? "모집 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요." : "현재 공개된 모집이 없습니다."}</p>
      </main>
    );
  }

  const status = mateRoundStatus(round);
  const canApply = !preview && status === "모집 중" && round.retain_through;
  const quotas = [round.outdoor_quota, round.work_quota, round.lifestyle_quota];

  return (
    <main className="bg-[#f7f3ec] text-[#20140d]">
      {localMatePreview && <p className="bg-[#ffebd8] px-5 py-2 text-center text-sm font-medium">로컬 미리보기 · 테스트 지원서에는 예시 정보만 입력해 주세요.</p>}
      <header className="border-b-4 border-[#ff6e32] bg-[#25211e] text-[#fff9f0]">
        <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10">
          <p className="text-sm font-bold text-[#ffab82]">{preview ? "관리자 미리보기" : status} · {round.round}기 크리에이터 모집 <span aria-hidden="true">👊</span></p>
          <h1 className="mt-2 text-[clamp(2.25rem,8vw,4.5rem)] font-black leading-none tracking-[-0.055em]">WORKUP MATE</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
            워크업 제품을 경험하고 자신만의 콘텐츠를 만들 크리에이터를 모집합니다.
          </p>
          {canApply && <a className={buttonClass + " mt-4"} href="#apply">지원서 작성하기</a>}
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="mate-guide" className="space-y-5">
          <h2 id="mate-guide" className="text-2xl font-black">모집 안내</h2>
          <div>
            <h3 className="font-bold">1. 활동 기간</h3>
            <p className="mt-2">{round.activity_period}</p>
          </div>
          <div>
            <h3 className="font-bold">2. 모집 일정</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt>모집 기간</dt><dd>{round.starts_on && round.ends_on ? `${formatMateDate(round.starts_on)} ~ ${formatMateDate(round.ends_on)}` : "미정"}</dd>
              <dt>최종 발표</dt><dd>{formatMateDate(round.announces_on)} <span className="inline-block">(선정자 개별 안내)</span></dd>
            </dl>
          </div>
          <div>
            <h3 className="font-bold">3. 모집 부문</h3>
            <ul className="mt-2 divide-y divide-stone-300 border-y border-stone-300">
              {Object.entries(MATE_STYLES).map(([key, label], index) => (
                <li className="flex flex-wrap justify-between gap-x-4 py-3" key={key}>
                  <span>{label}</span><span className="font-bold">{quotas[index] === null ? "인원 미정" : `${quotas[index]}명`}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold">4. 활동 내용</h3>
            <p className="mt-1 leading-relaxed">신상품·기획상품을 정기 협찬받고, 자신의 채널에 맞는 리뷰와 스타일링 콘텐츠를 기획·제작해 워크업을 알립니다.</p>
          </div>
          <div>
            <h3 className="font-bold">5. 지원 자격</h3>
            <p className="mt-1 leading-relaxed">SNS를 활발하게 운영하며 자신만의 스타일로 정기적으로 콘텐츠를 제작할 수 있는 분</p>
          </div>
          <div>
            <h3 className="font-bold">6. 지원 방법</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 leading-relaxed">
              <li><a href="https://www.instagram.com/workup_official_kr/" target="_blank" rel="noreferrer" className="font-bold underline">@workup_official_kr</a> 팔로우</li>
              <li>지원서 제출</li>
              <li>모집 게시물 댓글에 크리에이터 친구 태그</li>
            </ol>
          </div>
        </section>

        <section aria-labelledby="apply" className="self-start min-w-0 rounded-xl border border-stone-300 bg-white p-5 sm:p-7">
          <h2 id="apply" className="scroll-mt-28 text-2xl font-black">{round.round}기 지원서</h2>
          {(canApply || preview) ? (
            <MateActionForm action={submitMateApplication} className="mt-5 space-y-5" buttonClassName={buttonClass + " w-full"}
              submitLabel={preview ? "미리보기 · 제출 불가" : "지원서 제출하기"} preview={preview} successContent={<p>선정 결과는 발표일에 선정자에게 개별 안내합니다.</p>}>
              <input type="hidden" name="round" value={round.round} />
              <input type="hidden" name="retain_through" value={round.retain_through ?? ""} />
              <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>

              <label className="block font-bold">인스타그램 아이디
                <input className={inputClass + " font-normal"} name="sns_id" placeholder="workup_official_kr" autoCapitalize="none"
                  spellCheck={false} maxLength={31} pattern="@?[A-Za-z0-9._]{1,30}" required />
              </label>
              <fieldset>
                <legend className="font-bold">피드 스타일 <span className="text-sm font-normal text-stone-600">(1개 선택)</span></legend>
                <div className="mt-1">
                  {Object.entries(MATE_STYLES).map(([value, label]) => (
                    <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3">
                      <input className="size-4 accent-[#20140d]" type="radio" name="feed_styles" value={value} required />{label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="font-bold">이름<input name="name" className={inputClass + " font-normal"} autoComplete="name" maxLength={60} required /></label>
                <fieldset>
                  <legend className="font-bold">성별</legend>
                  <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-4">
                    {Object.entries(MATE_APPLICATION_GENDERS).map(([value, label]) => (
                      <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                        <input type="radio" name="gender" value={value} className="size-4 accent-[#20140d]" required />{label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="font-bold">연락처<MatePhoneInput className={inputClass + " font-normal"} /></label>
                <label className="font-bold">키 (cm)<input type="number" name="height_cm" min="50" max="260" step="0.1" className={inputClass + " font-normal"} inputMode="decimal" required /></label>
              </div>
              <MateAddressField />
              <label className="block font-bold">하고 싶은 말 <span className="text-sm font-normal text-stone-600">(필수 · 10자 이상)</span>
                <textarea name="message" className={inputClass + " font-normal"} rows={4} minLength={10} maxLength={1500} required />
              </label>
              <div className="space-y-3 text-sm leading-relaxed">
                <details className="group rounded-md border border-stone-300 bg-stone-50">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold [&::-webkit-details-marker]:hidden">
                    개인정보 수집·이용 및 활동 안내
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-5 shrink-0 group-open:rotate-180">
                      <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="space-y-5 border-t border-stone-300 px-4 py-4">
                    <section>
                      <h3 className="font-bold">1. 개인정보 수집 및 이용 안내</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li><strong>수집 항목:</strong> 이름, 연락처, SNS 계정 및 채널 정보 등 지원서에 기재한 개인정보</li>
                        <li><strong>수집 및 이용 목적:</strong> WORKUP MATE {round.round}기 지원자 확인, 선정 및 활동 운영, 공지사항 전달</li>
                        <li><strong>개인정보 보유 및 이용 기간:</strong> WORKUP MATE {round.round}기 활동 종료 시까지</li>
                        <li><strong>개인정보 파기:</strong> 활동 종료 후 수집된 개인정보는 지체 없이 파기합니다. 단, 관련 법령에 따라 보존이 필요한 경우 해당 법령에서 정한 기간 동안 보관합니다.</li>
                      </ul>
                      <Link href="/privacy" className="mt-2 inline-flex min-h-11 items-center underline">개인정보처리방침</Link>
                    </section>
                    <section>
                      <h3 className="font-bold">2. 콘텐츠 저작권 및 2차 활용 안내</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>크리에이터가 직접 제작한 콘텐츠의 1차 저작권은 해당 크리에이터에게 귀속됩니다.</li>
                        <li>지원자는 지원서 제출 시 WORKUP이 활동 과정에서 제작된 콘텐츠를 브랜드 홍보 및 마케팅 목적으로 2차 활용하는 것에 동의한 것으로 간주합니다.</li>
                        <li>2차 활용 범위는 WORKUP 공식 SNS, 홈페이지, 온라인 광고, 오프라인 홍보물 및 기타 브랜드 마케팅 채널을 포함합니다.</li>
                        <li>WORKUP은 콘텐츠의 홍보 목적에 따라 일부 편집, 재가공 및 재구성하여 활용할 수 있습니다.</li>
                        <li>콘텐츠 활용 시 크리에이터의 초상, 계정명 및 콘텐츠가 함께 노출될 수 있습니다.</li>
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-bold">3. 활동 및 콘텐츠 제작 유의사항</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>선정된 크리에이터는 안내된 활동 일정과 콘텐츠 업로드 가이드를 준수해야 합니다.</li>
                        <li>제공받은 제품 및 활동 미션에 대한 콘텐츠를 기한 내 제작하고 업로드해야 합니다.</li>
                        <li>콘텐츠 제작 시 WORKUP 브랜드 및 제품에 대한 허위·과장된 정보가 포함되지 않도록 유의해야 합니다.</li>
                        <li>타인의 저작권, 초상권 및 기타 권리를 침해하는 이미지, 영상, 음원 등의 사용을 금지합니다.</li>
                        <li>활동 기준 및 미션을 반복적으로 준수하지 않을 경우 향후 활동 및 프로그램 참여에 제한이 있을 수 있습니다.</li>
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-bold">4. 기타 안내</h3>
                      <ul className="mt-2 list-disc space-y-2 pl-5">
                        <li>제출된 지원서는 WORKUP MATE {round.round}기 선발 및 운영 목적으로 활용됩니다.</li>
                        <li>지원서에 기재한 정보가 사실과 다를 경우 선정이 취소될 수 있습니다.</li>
                        <li>세부 활동 일정 및 미션은 최종 선정자에게 별도 안내됩니다.</li>
                      </ul>
                    </section>
                  </div>
                </details>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
                  <input type="checkbox" name="consent" value="yes" className="size-4 shrink-0 accent-[#20140d]" required />
                  개인정보 수집·이용에 동의합니다. (필수)
                </label>
                <p className="text-xs text-stone-700">지원서를 제출하면 콘텐츠 2차 활용에 동의한 것으로 간주합니다.</p>
              </div>
            </MateActionForm>
          ) : <p className="mt-4">{status === "모집 예정" ? "모집 시작일에 지원서를 작성할 수 있습니다." : "지원서 접수가 마감되었습니다."}</p>}
        </section>
      </div>
    </main>
  );
}