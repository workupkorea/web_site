import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import MateActionForm from "@/components/MateActionForm";
import MateAddressField from "@/components/MateAddressField";
import MateHeightInput from "@/components/MateHeightInput";
import MatePhoneInput from "@/components/MatePhoneInput";
import { isAdmin } from "@/lib/admin-auth";
import { mateActivityImageHref } from "@/lib/mate-activities";
import { listMateActivities } from "@/lib/mate-activity-server";
import { MATE_APPLICATION_GENDERS, MATE_APPLICATION_REQUIREMENTS, MATE_STYLES, formatMateDate, mateRoundStatus, parseRound } from "@/lib/mate";
import { listMateRounds } from "@/lib/mate-server";
import { submitMateApplication } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "WORKUP MATE 모집",
  description: "워크업의 제품을 직접 경험하고 자신만의 콘텐츠로 WORKUP을 표현할 크리에이터를 모집합니다.",
};

const inputClass = "mt-1.5 min-h-11 w-full rounded-lg border border-[#bcc2b9] bg-white px-3 py-2 text-base font-normal text-[#191d18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#384436]";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#ef713e] px-4 py-2.5 text-sm font-bold text-[#21160f] hover:bg-[#fa8657] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#384436] disabled:opacity-60";
const optionClass = "flex min-h-11 min-w-0 cursor-pointer items-center rounded-lg border border-[#d6dbd3] py-2 text-sm has-checked:border-[#48574a] has-checked:bg-[#eef2eb]";
const radioClass = "size-4 shrink-0 accent-[#384436]";
const consentCopy = "지원서 제출에는 활동 중 제작한 콘텐츠의 2차 활용에 대한 동의가 포함됩니다.";

function GuideItem({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <section className="border-t border-[#d6dbd3] py-3.5 first:border-t-0 first:pt-0">
    <h3 className="flex items-baseline gap-2 text-sm font-bold">
      <span className="min-w-4 text-[#687367]">{number}.</span>{title}
    </h3>
    <div className="mt-1.5 pl-6 text-sm leading-relaxed text-[#454d43]">{children}</div>
  </section>;
}

function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-[#dce2d8] pt-5 first:border-0 first:pt-0">
    <h3 id={id} className="text-base font-[700] tracking-tight text-[#273428]">{title}</h3>
    {children}
  </section>;
}

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
  const canApply = !preview && status === "모집 중" && Boolean(round.retain_through);
  const quotas = [round.outdoor_quota, round.work_quota, round.lifestyle_quota];
  const showForm = canApply || preview;
  const activities = await listMateActivities(round.round, true);
  const productImages = (activities.data ?? []).flatMap(({ activity_no, product_name, product_image_version }) =>
    product_image_version ? [{
      activity_no, product_name,
      src: mateActivityImageHref(round.round, activity_no, product_image_version, preview ? undefined : "recruitment"),
    }] : []).reverse();

  return (
    <main className="bg-[#f3f5f0] text-[#191d18] [font-family:Pretendard,'Noto_Sans_KR',sans-serif]">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-7 sm:pt-5">
        <header className="overflow-hidden rounded-xl border border-[#d8ddd4] bg-[#e9eee6]">
          <div className="grid gap-3 px-4 py-3.5 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-5 sm:px-6">
            <div className="flex min-w-0 flex-col items-center text-center sm:items-start sm:text-left">
              <h1 className="max-w-full break-keep text-[clamp(1.375rem,5.4vw,1.75rem)] font-[800] leading-tight tracking-[-0.045em] sm:order-2 sm:text-[clamp(1.85rem,3.6vw,2.4rem)]">
                WORKUP MATE
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#424d41] sm:order-1 sm:mb-1 sm:mt-0">
                <span>{round.round}기 크리에이터 모집</span>
                <span className="rounded-full border border-[#bec9ba] bg-white/55 px-2 py-0.5">{status}</span>
              </div>
              <p className="mt-1.5 hidden text-sm leading-snug text-[#435042] sm:order-3 sm:block">워크업 제품을 경험하고, 나만의 콘텐츠를 만들어 보세요.</p>
            </div>
            {showForm && <a className={buttonClass + " w-full shrink-0 sm:w-auto"} href="#apply">
              {preview ? "지원서 보기" : "지원서 작성하기"}
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4">
                <path d="M10 4v11m-4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>}
          </div>
        </header>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-9 pt-4 sm:px-7 sm:pb-12 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-8">
        <section aria-labelledby="mate-guide" className="min-w-0 rounded-xl border border-[#d8ddd4] bg-[#f9faf7] px-4 py-4 sm:px-6 lg:self-start">
          <h2 id="mate-guide" className="mb-4 text-xl font-[750] tracking-tight">모집 안내</h2>
          <div>
            <GuideItem number={1} title="활동 기간">
              <p>{round.activity_period}</p>
            </GuideItem>
            <GuideItem number={2} title="모집 일정">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                <dt>모집 기간</dt>
                <dd>{round.starts_on && round.ends_on ? <>
                  <span className="inline-block">{formatMateDate(round.starts_on)}</span>{" "}
                  <span className="inline-block">~ {formatMateDate(round.ends_on)}</span>
                </> : "미정"}</dd>
                <dt>최종 발표</dt><dd>{formatMateDate(round.announces_on)} <span className="inline-block text-xs">(선정자 개별 안내)</span></dd>
              </dl>
            </GuideItem>
            <GuideItem number={3} title="모집 부문">
              <ul className="divide-y divide-[#e2e6de]">
                {Object.entries(MATE_STYLES).map(([key, label], index) => (
                  <li className="flex flex-wrap justify-between gap-x-4 py-1.5 first:pt-0 last:pb-0" key={key}>
                    <span>{label}</span><span className="font-semibold tabular-nums">{quotas[index] === null ? "인원 미정" : `${quotas[index]}명`}</span>
                  </li>
                ))}
              </ul>
            </GuideItem>
            <GuideItem number={4} title="활동 내용">
              <p>신상품·기획상품을 정기 협찬받고, 자신의 채널에 맞는 리뷰와 스타일링 콘텐츠를 기획·제작해 워크업을 알립니다.</p>
              {productImages.length > 0 && <div className="mt-3 space-y-2">
                <h4 className="text-sm font-[700] text-[#273428]">활동 제품 사진</h4>
                <div className="grid grid-cols-2 gap-2">
                  {productImages.map(({ activity_no, product_name, src }) => (
                    <figure key={activity_no} className="min-w-0 overflow-hidden rounded-lg border border-[#d6dbd3] bg-white">
                      <Image src={src} alt={product_name} width={480} height={360} unoptimized
                        className="aspect-[4/3] w-full bg-[#eef2eb] object-contain" />
                      <figcaption className="break-keep px-2 py-1.5 text-xs font-semibold">
                        <span className="block text-[#596557]">{activity_no}회차</span>{product_name}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>}
            </GuideItem>
            <GuideItem number={5} title="지원 자격">
              <p>{MATE_APPLICATION_REQUIREMENTS}</p>
            </GuideItem>
            <GuideItem number={6} title="지원 방법">
              <ol className="list-decimal space-y-0.5 pl-5">
                <li><a href="https://www.instagram.com/workup_official_kr/" target="_blank" rel="noreferrer" className="font-bold underline">@workup_official_kr</a> 팔로우</li>
                <li>지원서 제출</li>
                <li>모집 게시물 댓글에 크리에이터 친구 태그</li>
              </ol>
            </GuideItem>
          </div>
        </section>

        <section aria-labelledby="apply" className="@container self-start min-w-0 overflow-hidden rounded-xl border border-[#d8ddd4] bg-white">
          <h2 id="apply" className="scroll-mt-28 border-b border-[#d8ddd4] bg-[#eef2eb] px-4 py-4 text-xl font-[750] tracking-tight sm:px-6">워크업 메이트 {round.round}기 지원서</h2>
          {showForm ? (
            <MateActionForm action={submitMateApplication}
              className="grid gap-5 px-4 py-5 text-sm sm:px-6 sm:py-6 [&[role=status]]:rounded-lg [&[role=status]]:text-[#384436]" buttonClassName={buttonClass + " w-full"}
              submitLabel="지원서 제출하기" preview={preview} successContent={<p>선정 결과는 발표일에 선정자에게 개별 안내합니다.</p>}>
              <input type="hidden" name="round" value={round.round} />
              <input type="hidden" name="retain_through" value={round.retain_through ?? ""} />
              <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" /></div>

              <div className="grid min-w-0 gap-6">
                <FormSection id="mate-channel" title="채널 정보">
                  <label className="block font-bold">인스타그램 아이디
                    <input className={inputClass} name="sns_id" placeholder="workup_official_kr" autoCapitalize="none"
                      spellCheck={false} maxLength={31} pattern="@?[A-Za-z0-9._]{1,30}" required />
                  </label>
                  <fieldset>
                    <legend className="font-bold">피드 스타일 <span className="text-sm font-normal text-stone-600">(1개 선택)</span></legend>
                    <div className="mt-1.5 grid gap-2 @min-[37rem]:grid-cols-3">
                      {Object.entries(MATE_STYLES).map(([value, label]) => (
                        <label key={value} className={optionClass + " gap-2.5 px-3"}>
                          <input className={radioClass} type="radio" name="feed_styles" value={value} required /><span className="break-keep">{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </FormSection>
                <FormSection id="mate-basics" title="기본 정보">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    <label className="font-bold">이름<input name="name" className={inputClass} autoComplete="name" maxLength={60} required /></label>
                    <fieldset>
                      <legend className="font-bold">성별</legend>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {Object.entries(MATE_APPLICATION_GENDERS).map(([value, label]) => (
                          <label key={value} className={optionClass + " justify-center gap-1.5 px-1 leading-tight"}>
                            <input type="radio" name="gender" value={value} className={radioClass} required /><span className="whitespace-nowrap">{label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="font-bold">연락처<MatePhoneInput className={inputClass} placeholder="예: 01012345678" /></label>
                    <label className="font-bold">키 (cm)<MateHeightInput className={inputClass} /></label>
                  </div>
                  <MateAddressField />
                </FormSection>
                <FormSection id="mate-statement" title="지원 내용">
                  <textarea name="message" className={inputClass} rows={2} minLength={10} maxLength={1500}
                    aria-labelledby="mate-statement" placeholder="10자 이상 입력해 주세요." required />
                </FormSection>
                <FormSection id="mate-consent" title="동의 및 안내">
                  <div className="space-y-3 text-sm leading-relaxed">
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
                      <input type="checkbox" name="consent" value="yes" className={radioClass} required />
                      개인정보 수집·이용에 동의합니다. (필수)
                    </label>
                    <p className="text-xs leading-relaxed text-[#b34a16]">* 지원서 제출 시 콘텐츠 2차 활용에 동의합니다.</p>
                    <details className="group rounded-lg border border-[#d6dbd3] bg-[#f7f9f5]">
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
                            <li>{consentCopy} 워크업은 해당 콘텐츠를 브랜드 홍보 및 마케팅에 활용할 수 있습니다.</li>
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
                  </div>
                </FormSection>
              </div>
            </MateActionForm>
          ) : <p className="px-4 py-5 sm:px-6">{status === "모집 예정" ? "모집 시작일에 지원서를 작성할 수 있습니다." : "지원서 접수가 마감되었습니다."}</p>}
        </section>
      </div>
    </main>
  );
}
