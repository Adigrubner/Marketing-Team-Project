# Delivery layer analysis for a small-budget Meta campaign: spend pacing, reach penetration, frequency, CPM, fatigue

Research date: 26 Oct 2026. Web research only, with no Meta API calls and no project tools run.

Source labels used below:
- **[META]** is Meta's own wording, quoted directly or via a practitioner who quotes Meta.
- **[PRACT]** is a known practitioner (Jon Loomer, Ben Heath).
- **[VENDOR]** is a tool or agency selling something. Treat these as vendor claims.
- **[RESEARCH]** is a brand-lift or measurement study.
- **[NEWS]** is trade press or secondary coverage.

Caveat on the main primary source: Meta's own Help Center page on daily budgets (https://www.facebook.com/business/help/190490051321426) did not render through the fetch tool (only the title loaded). Every Meta pacing and diagnostic rule below therefore comes through practitioners who quote Meta, not from the page itself.

Campaign arithmetic used in the Inferences (from the numbers in the brief):
- Spend over 5 days was 283.83 ILS against a nominal 375 ILS (75 x 5), which is **75.7% delivery**.
- CPM is 283.83 / 3,758 x 1000 = **75.5 ILS**.
- Frequency is 3,758 / 2,234 = **1.68**.
- CTR (all) is 108 / 3,758 = **2.87%**.
- The four listed daily spends add up to 247.05. The fifth (likely partial) day is therefore about 36.78 ILS.

---

## 1. Spend pacing on a small daily budget: when is under-delivery a sign of a too-small audience or too-high costs, and what does Meta say about daily variance?

### Takeaway
Since late 2023, Meta treats a daily budget as a weekly average. Any single day can spend up to 75% above the daily budget, and weekly spend is capped at 7x the daily budget. Swings like 26 to 98 ILS on a 75 ILS/day budget are within the rules. Experts read persistent under-spend as a warning sign. With a small audience (especially combined with restricted placements) and an expensive optimization event, persistent under-spend usually means the audience or the result volume is too small for the budget.

### Cited Findings
- **[META via PRACT] Up to 75% over daily budget per day.**
  - Meta's in-product wording, as quoted by Jon Loomer: "On days when better opportunities are available for you, we may spend up to 75% over your daily budget."
  - The old limit was 25% over. Loomer's example is a $100/day budget that can spend up to $175 on a single day, averaging $100/day and capped at $700 per calendar week. The change was "still rolling out" when Loomer wrote about it.
  - The article was published 2 Nov 2023 and last modified 1 Mar 2025. — [Jon Loomer, Updates to Meta Ads Budgeting](https://www.jonloomer.com/updates-to-meta-ads-budgeting/)
- **[VENDOR, citing Meta] Weekly balancing.**
  - Total weekly spend "doesn't exceed seven times your daily budget". Over-spend days are offset by lower-spend days.
  - Article dated 24 May 2026. It links to Meta but does not quote it directly. — [Vizup, Meta Ads Minimum Budget Requirements 2026](https://www.tryvizup.com/blog/meta-ads-minimum-budget-requirements-2026)
- **[VENDOR, third-party help desk] The week runs Sunday to Saturday**, with the $100 -> max $175/day -> max $700/week example. I did not verify this against Meta's page. — [Zenvia support, Daily budget: how it works](https://support.zenvia.com/kb/en/article/495315/daily-budget-how-it-works-and-what-to-do-about-value-fluctuation)
- **[PRACT] A small audience means the budget will not spend.**
  - Loomer: "If your goal is to target a very small audience and set a budget that may be suitable for a larger audience, you shouldn't expect your entire budget to spend." His fixes are to expand the audience or lower the daily budget.
  - He also lists these reasons for under-spend: bid or cost-per-result goals set too low ("expect to get under-delivery"), Learning Limited, dayparting, the Reach frequency cap, automated rules, spending limits, and plain poor performance ("weak results slow delivery").
  - Published 27 Mar 2023, updated 1 Mar 2025. — [Jon Loomer, Why Won't Meta Spend My Advertising Budget?](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)
- **[META via PRACT] Learning-phase volume rules.**
  - Meta recommends a budget high enough for "at least 10 optimized actions per day".
  - An ad set "may need to generate up to 50 optimized actions per week" to exit learning. If it can't, it lands in Learning Limited, which "often results in restricted delivery".
  - The suggested remedy is to switch to a higher-volume optimization event. — [Jon Loomer, Why Won't Meta Spend My Advertising Budget?](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)
- **[VENDOR] Meta may hold back delivery on small audiences.**
  - "If the audience is too small, Meta may limit delivery" to avoid overexposing the same people.
  - Learning Limited "often results in volatile costs and inconsistent delivery".
  - Its practical planning range for retargeting is $20-50/day. The article says these are not Meta's official minimums. — [Vizup 2026](https://www.tryvizup.com/blog/meta-ads-minimum-budget-requirements-2026)
- **[PRACT] Diagnosis order for under-delivery**, per Loomer:
  1. Check the Delivery column for flags (Learning Limited, Creative Fatigue).
  2. Use a "Breakdown by day" to find when the problem started.
  3. Check Activity History for edits or pauses around that date.
  4. Check that no automated rules or spending limits apply. — [Jon Loomer, Why Won't Meta Spend My Advertising Budget?](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)
- **[VENDOR / open-source tool] Pacing alert threshold.** The open-source "Meta Ads Kit" makes "is spend on pace vs. today's budget" the first of its five daily questions. Its default pacing alert fires at a 15% deviation. These are tool defaults, not an industry standard. — [Meta Ads Kit, daily questions](https://mintlify.wiki/TheMattBerman/meta-ads-kit/concepts/daily-questions)

### Inferences
- **Daily swings are within the rules.**
  - With a 75 ILS/day total budget, Meta's ceiling is about 131 ILS on any single day and 525 ILS per week.
  - The highest day so far (98.55 = 131% of 75) is within that ceiling, so day-to-day swings of 26.56 / 98.55 / 42.09 / 79.85 are not by themselves a malfunction.
  - The agent should judge pacing over a full Sunday-Saturday week (or a rolling 7 days), not on single days.
- **The weekly cap is a ceiling, not a floor.** Meta promises not to exceed 7x the daily budget per week. None of the sources say it will make up under-spend later. A persistent shortfall (5 days at 75.7% of nominal) is real under-delivery, not timing.
- **Pacing must be read per ad set.** These are ad-set budgets, so the 75% / 7x rule applies separately to each ad set:
  - Warm ad set: max about 43.75 ILS/day, 175 ILS/week.
  - New-audience ad set: max 87.5 ILS/day, 350 ILS/week.
- **The warm ad set's under-spend fits the "small audience" pattern** described by Loomer and Vizup. It is compounded by:
  - restricting placements to FB feed + IG feed (fewer impression opportunities per person per day);
  - an expensive optimization event (a WhatsApp conversation), so Meta's estimated action rate is low on a small pool.
- **Learning Limited is effectively certain for this campaign.** At about 25 ILS/day, the warm ad set cannot reach 50 conversations per week. "Learning Limited" in that ad set's Delivery column should be read as expected, not as an error.
- **Rule of thumb for the agent (inference, not a published threshold).** Flag "audience too small for budget" when all of the following hold:
  - the ad set spends below about 80-85% of its daily budget for 3 or more consecutive days;
  - its CPM is rising;
  - its new (incremental) reach per day is shrinking.
- **How to tell an audience limit from a cost limit:**
  - If under-spend comes with a rising CPM and flat reach, the audience is the limit.
  - If it comes with a stable CPM and low CTR or conversion rate, Meta's predicted results are the limit.
- **Interpretation of the alert threshold.** The 15% pacing alert from the open-source kit is a reasonable flag for a full week's spend. On single days it would fire constantly under the 75% rule.

### Gaps
- I could not read Meta's own Help Center text on daily budgets (the page would not render). Two points remain unverified against Meta:
  - the Sunday-Saturday week definition;
  - whether the 75% flexibility has fully rolled out to all accounts.
- I found no published numeric threshold, from Meta or from an expert, for how much under-spend means "audience too small" versus "bid too low". The 80-85% rule above is my inference.

---

## 2. How experts estimate the share of a small custom audience already reached, and what penetration is healthy or saturated

### Takeaway
Reach is a deduplicated, estimated count of unique Accounts Center accounts. Reach from different ads, ad sets or campaigns must never be added up; the correct figure is the ad-set-level (or campaign-level) reach for the date range. I found no credible published benchmark for "healthy" 7/14/30-day penetration of a ~3,000-person warm audience. The practical method is to track the cumulative ad-set reach curve against the matched audience size and watch for it to flatten.

### Cited Findings
- **[PRACT] Summing reach is "one of the most common mistakes".**
  - Loomer: "Reach is a measure of unique users. One of the most common mistakes is to simply add numbers together (for different ads, ad sets, or campaigns), and presume that you have total counts of the people reached."
  - This was quoted in a search snippet. The full page returned HTTP 403 and was not opened. — [Jon Loomer (jonloomer.com, p=38801)](https://www.jonloomer.com/?p=38801)
- **[VENDOR docs] Account-level reach is lower than the sum of ad-set reach.** "Total account-level reach is almost always lower than the sum of individual ad set reaches. Use the account-level reach figure when reporting total audience size." — [AdAdvisor docs, Reach](https://adadvisor.ai/docs/learn/reach.md)
- **[META via PRACT] Reach counts Accounts Center accounts, not people.**
  - Reach is now defined as "the number of Accounts Center accounts that saw your ads at least once". Loomer says the calculation did not change, only the naming.
  - A person seen on both Facebook and Instagram counts once if the two accounts are linked in Accounts Center, and twice if they are not. — [Jon Loomer, Meta ads metric update: Accounts Center account](https://www.jonloomer.com/meta-ads-metric-update-accounts-center-account/)
- **[META via PRACT] Estimated Audience Size is a separate, real-time estimate** of eligible Accounts Center accounts for the ad set's settings. It is not the number of people who will actually be reached. — [Jon Loomer glossary, Estimated Audience Size](https://www.jonloomer.com/glossary/estimated-audience-size/)
- **[NEWS / independent analysis] Meta revises its reach estimates.** Meta has periodically corrected its potential-reach estimates, about every 12-18 months over 13 years of tracking, sometimes downward. — [DataReportal, Changes in Meta's ad reach numbers (2023)](https://datareportal.com/reports/digital-2023-deep-dive-changes-in-metas-ad-reach-numbers)
- **[VENDOR] Customer-list match rates vary widely**, so the "3,000-3,500" figure may not equal the reachable pool:
  - Typical Meta list match rates are cited at 30-60%, 40-70% or 50-80%.
  - Business lists are often 25-40%.
  - Business-email-only lists are 10-15%, rising to 40-60% when personal emails and phones are added.
  - The sources conflict; no Meta figure was found. — [Primer, Customer list audiences for B2B](https://www.sayprimer.com/blog/customer-list-audiences-for-b2b-marketers); [Benly, Custom audiences guide](https://benly.ai/learn/meta-ads/custom-audiences-guide)
- **[VENDOR, low authority] Small retargeting pools saturate fast.** One frequency guide notes that a retargeting audience of 5,000 "will hit high frequency within days on any meaningful budget". — surfaced in search from [AdStellar, Facebook ads frequency too high](https://www.adstellar.ai/blog/facebook-ads-frequency-too-high) / [Adligator, frequency benchmarks by vertical 2026](https://adligator.com/blog/facebook-ads-frequency-benchmarks-by-vertical-2026) (exact page not confirmed)

### Inferences
- **The campaign row mixes two populations.**
  - The campaign-level reach of 2,234 is deduplicated across both ad sets, so it says nothing about penetration of the warm audience.
  - The agent must pull **ad-set-level reach** for the warm ad set for the date range from launch to today. The API supports this at `level=adset`, with no per-day breakdown and the full date range.
- **Bounding warm penetration from per-ad reach.**
  - Per-ad reach in the warm ad set is 145-214 per ad across 4 ads.
  - The true deduplicated ad-set reach lies between the largest single ad (about 214) and the sum of the four, which is at most about 856.
  - Penetration after 5 days is therefore roughly 6-29% of a 3,000 audience (6-24% of 3,500).
  - Summing per-ad reach (about 600-850) overstates it, because the same designer may have seen 2 or more of the carousels.
- **The realistic denominator is smaller than 3,000-3,500.** It is the matched, active-on-FB/IG-feed population:
  - if the warm audience is an uploaded B2B list, vendor match-rate figures suggest it could be much smaller;
  - FB feed + IG feed only further limits daily reachability.
- **Suggested method: track a cumulative reach curve (inference, not sourced).**
  - Each day, pull the warm ad set's lifetime-to-date reach.
  - New reach per day = cumulative reach today minus cumulative reach yesterday.
  - The audience is saturating when new reach per day falls toward zero while frequency keeps climbing. This is far more informative than any fixed "% reached" target.
- **What the budget can deliver (arithmetic).**
  - At 25 ILS/day and a CPM around 75 ILS, the warm ad set buys about 330 impressions/day, or about 2,300/week, if it spends fully.
  - Spread over about 3,000 people that is under 1 impression per person per week, if everyone were reachable.
  - Spread over a reachable pool of about 1,000, it is about 2.3 per week.
  - So 7-day frequency, not lifetime, is the number that will reveal saturation.

### Gaps
- **No credible benchmark for healthy reach penetration.** I found no Meta, practitioner or research figure for healthy vs saturated penetration (% of a custom audience reached) at 7, 14 or 30 days for a warm audience of ~3,000. Any number here would be an estimate. Treat the "flattening reach curve" method as the substitute.
- **Retired saturation tool not confirmed.** Meta used to offer an "audience saturation" view in Delivery Insights. I could not confirm in this research whether any such tool still exists in 2026.
- **Meta does not publish how account- or campaign-level deduplicated reach is computed** (it is an estimate).

---

## 3. Frequency: time window, thresholds for warm small vs cold audiences, and the evidence on frequency vs performance decay

### Takeaway
Practitioners read frequency over a recent window, typically 7 days, not as lifetime frequency. They treat it as context rather than a trigger: Loomer says "there isn't a 'good' or 'bad' frequency". Cold-audience rules of thumb cluster at about 2-3.5. Warm audiences tolerate much higher frequency, often cited as 4-7 per week, with Heath reporting 10+ still working. The only large Meta study (2020, brand metrics) found diminishing returns after about 5-6 impressions. None of these thresholds was measured on click-to-WhatsApp conversation objectives.

### Cited Findings
- **[PRACT] High frequency is not a problem by itself.**
  - Loomer: "A high frequency, by itself, is not problematic"; "There isn't a 'good' or 'bad' frequency." If results aren't tanking, frequency doesn't matter.
  - Restricted audiences (remarketing, small radius) and restricted placements make fatigue likely: "It will not take long before your frequency begins climbing and performance drops."
  - Published 15 Sep 2025. — [Jon Loomer, Creative Fatigue: What It Is and How to Prevent It](https://www.jonloomer.com/creative-fatigue-meta-ads/)
- **[PRACT, OLD (2018)] Ben Heath's thresholds.**
  - Cold audiences: "Most of the time, I start to see a drop off in results when Facebook ad frequency reaches 2.0-2.5."
  - Warm audiences: "It is not uncommon for ads to deliver fantastic results with ad frequencies of 10+ when they are targeted at warm audiences... There isn't an established rule."
  - "The smaller your audience and the more you spend, the faster your Facebook ad frequency will increase."
  - Act only when cost per result has slipped: "Whilst your ads continue to generate a great cost per conversion, the answer is: not yet."
  - Dated 24 May 2018, which predates Advantage+ and Andromeda-era delivery. — [Heath Media, 3 Ways to Combat Facebook Ad Frequency Issues](https://heathmedia.co.uk/?p=373542)
- **[RESEARCH, Meta, OLD (2020)] Facebook IQ analysis of 2,439 Brand Lift campaigns.**
  - Ad recall and action intent results "start to taper off" after about 5-6 impressions, even for good creative.
  - Average campaigns kept rising up to about 4-5 impressions. High-engagement creative performed better at every frequency.
  - Meta says there is no one-size-fits-all frequency and advertisers should test.
  - The study measured brand metrics, not conversions. Reported 27 Oct 2020. — [Social Media Today, Facebook shares new insight on ad performance based on frequency](https://www.socialmediatoday.com/news/facebook-shares-new-insight-on-ad-performance-based-on-frequency/587878/)
- **[RESEARCH, agency meta-analysis] Brainlabs.**
  - Sample: 46 Meta brand lift studies covering 225 UK campaigns from 10 brands, analysed with Random Forest regression.
  - The strongest recall gains came from campaigns delivering "two exposures every seven days".
  - The page is undated and the chart values are not in the text. — [Brainlabs, 46 Meta Studies, 225 Campaigns](https://www.brainlabsdigital.com/meta-brand-lift-studies-objectives-creatives-results/)
- **[RESEARCH, Google/YouTube, not Meta] Frequency 3+ and brand lift.** Google reported that frequencies of 3 or more drove 61% higher absolute brand lift than frequencies of 1-2. This was seen in a search snippet only. — [Think with Google, Maximizing video results](https://thinkwithgoogle.com/marketing-strategies/video/inside-google-marketing-maximizing-video-results)
- **[VENDOR] 2026 heuristics:**
  - Atria: top-funnel fatigue at roughly 2.5-3.0 (dated 3 Jun 2026). — [Atria, Meta creative fatigue: diagnose and fix (2026)](https://www.tryatria.com/blog/meta-creative-fatigue-diagnose-and-fix-2026)
  - Meta Ads Kit (open-source tool): default frequency ceiling of 3.5. — [Meta Ads Kit, daily questions](https://mintlify.wiki/TheMattBerman/meta-ads-kit/concepts/daily-questions)
- **[VENDOR, low authority, ranges conflict] Warm and retargeting frequency per week.**
  - Typical warm/retargeting frequency is 4-7 per week, with an upper bound of about 8-10 before annoyance.
  - Ecommerce cart abandoners run at 6-10 per week.
  - One vendor flags retargeting above 7 per week in a 7-day window.
  - Another says a 180-day retargeting pool with a small budget and no caps can hit 8-10 per week, and recommends capping at 3-4 per week.
  - Surfaced across vendor blogs; individual attributions not verified. — [AdStellar](https://www.adstellar.ai/blog/facebook-ads-frequency-too-high); [Adligator 2026](https://adligator.com/blog/facebook-ads-frequency-benchmarks-by-vertical-2026); [Stackmatix, Meta ads frequency management](https://www.stackmatix.com/blog/meta-ads-frequency-management)
- **[META via PRACT] Frequency caps exist only in Reach-type buying.**
  - The Reach objective's default cap is 1 impression per 7 days, and delivery can slow after the first few days for small audiences. — [Jon Loomer, Why Won't Meta Spend](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)
  - A "Daily Unique Reach" option limits delivery to at most once per person per day, but it does not optimize for an action. — [Jon Loomer glossary, Daily Unique Reach](https://www.jonloomer.com/glossary/daily-unique-reach/)
  - Reservation has replaced Reach & Frequency buying. — [Jon Loomer glossary, Reservation buying type](https://www.jonloomer.com/glossary/reservation-buying-type/)

### Inferences
- **The analyst should report three frequency numbers per ad set, not one total.**
  - **7-day frequency** = 7-day impressions / 7-day deduplicated reach. Pull it as a single 7-day range; never average or add daily frequencies.
  - **Lifetime-to-date frequency**, for context.
  - **Daily frequency trend.**
  - The campaign-level 1.68 blends a 3,000-person warm pool with a large Advantage+ pool and hides the warm ad set's real exposure.
- **Lifetime frequency only grows.** It rises mechanically with time on a closed audience, so it is the wrong trigger. 7-day frequency is the comparable number week to week.
- **Suggested bands for this campaign.** These are synthesized from the sources above, are not a validated standard, and should be framed to the user as heuristics:
  - **Warm ad set:** 7-day frequency up to about 4-6 is normal. Above about 7 per week, check whether cost per conversation and CTR are holding. Act only if they are worsening (Heath, Loomer).
  - **New-audience ad set:** 7-day frequency above about 2.5-3.5 is a watch signal (Heath 2.0-2.5 is old; Atria 2.5-3; the open-source kit 3.5). This also applies only together with worsening cost or CTR.
  - The B2B vendor guidance already on file (Flighted: 1-2 per person per week for prospecting, 3-5 for retargeting) sits at the conservative end of these ranges.
- **No frequency-cap lever on this campaign.** The campaign uses the Messages objective, so it has no frequency-cap setting. The levers are budget size, number and variety of ads, placements, and audience size. This is an inference from Loomer's note that caps belong to Reach buying. I did not verify current Meta documentation for Engagement/Messages objectives.
- **Evidence quality.** All "decay" evidence is either brand-lift (awareness/recall) or e-commerce practitioner experience. None is specific to B2B click-to-WhatsApp, so the campaign's own cost per conversation trend is the final arbiter.

### Gaps
- I found no study, from Meta or independent, on frequency vs conversion or messaging performance for small B2B warm audiences.
- I found no primary Nielsen source. A Nielsen Australia "5-9 exposures optimal" figure appeared only secondhand in search results, without a verifiable primary link.
- I did not confirm whether Meta currently offers any frequency control for the Engagement/Messages objective in 2026.

---

## 4. CPM about 2x the country median: what drives it and how experts diagnose it

### Takeaway
The CPM here is about 75.5 ILS (about $20), roughly 2.2x the Israel median already on file ($9.15, SuperAds). That is about the global SuperAds median, not unusual globally. Known drivers all apply to this campaign at once:
- a small, highly targeted audience;
- warm/retargeting delivery;
- possible overlap between the two ad sets;
- feed-only placements;
- an expensive optimization event (conversations);
- the start of Q4.

Experts diagnose a high CPM by splitting it by ad set, placement and day, then checking overlap and relevance. A high CPM is acceptable if cost per conversation is acceptable.

### Cited Findings
- **[META, via secondary] How the auction ranks ads.** Meta ranks ads by "total value", which combines the bid, the estimated action rates and ad quality, so the highest bid does not automatically win. Secondary guides disagree on whether these inputs multiply or add, and Meta does not publish coefficients. — [Dotidot, Meta Ads auction](https://www.dotidot.io/post/meta-ads-auction-how-facebook-decides-which-ads-win)
- **[VENDOR] Narrow audiences cost more.**
  - Narrow audiences mean "competing in a smaller auction pool where more advertisers are chasing the same users. This drives up the price."
  - Stale retargeting lists mean "paying premium CPMs to reach people who are no longer in the consideration window". — [Lebesgue, How to lower CPM on Facebook ads](https://lebesgue.io/facebook-ads/how-to-lower-cpm-on-facebook-ads-practical-steps-for-ad-cost-optimization/)
- **[VENDOR] Ad sets bidding against each other.**
  - Internal auction competition (ad sets targeting the same people) inflates CPM. One guide calls it "the most common audience problem".
  - Practical threshold: "keep your audience overlap under 30%". The native overlap tool compares only two saved audiences at a time. — surfaced in search from [Madgicx, Audience overlap tool](https://madgicx.com/blog/audience-overlap-tool) / [Bestever, Audience overlap 2025](https://www.bestever.ai/post/audience-overlap) (attribution of each quote not verified)
- **[PRACT] Restricted placements.** Restricting placements limits the audience reached and the ad versions shown, which raises fatigue risk. — [Jon Loomer, Creative Fatigue (Sep 2025)](https://www.jonloomer.com/creative-fatigue-meta-ads/)
- **[VENDOR dataset] Q4 seasonality in global median CPM (SuperAds):**

  | Month | Global median CPM |
  |---|---|
  | Oct 2025 | 21.69 |
  | Nov 2025 (peak) | 25.22 |
  | Dec 2025 | 22.04 |
  | Jan 2026 | 15.74 (the reset) |

  - That is +42% from Jan 2025 to the Nov 2025 peak. The currency is presumably USD. — [SuperAds, Facebook Ads CPM](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille)
- **[VENDOR/agency] Geist Q4 2025:**
  - Early November CPMs rose about 3% and late November about 11%, with spikes by vertical (Food & Beverage +42%, Health & Wellness +36%).
  - Early December was +11%. — [Geist, Q4 2025 Digital Ad Rate Trends](https://geistm.com/blog/meta-rate-trends-q4-2025/)
- **[NEWS, Meta earnings] Annual price trend.** Meta's Q4 2025 average price per ad rose 6% year on year, a much smaller annual change than the seasonal swings. — [Storyboard18, Meta Q4 2025 results](https://www.storyboard18.com/advertising/meta-q4-2025-advertising-revenue-surges-to-58-1-billion-ad-pricing-rises-6-88466.htm)
- **[VENDOR] Click-to-WhatsApp benchmarks.**
  - Kanal puts the median CTWA CPM at about €6-9 and median cost per conversation at about €0.80-1.50. It also says its own 2025 figures are outdated.
  - Spurnow notes that "Meta itself publishes no industry benchmark" for these ads, that vendors define a "conversation" differently, and that vendor cost-per-conversation figures range from €1.50 to €8+.
  - Both use undisclosed samples. — [Kanal, CTWA benchmarks 2026](https://getkanal.com/blog/click-to-whatsapp-ads-benchmarks-2026); [Spurnow, CTWA benchmarks](https://www.spurnow.com/en/blogs/click-to-whatsapp-ads-benchmarks)

### Inferences
- **Context for the 2x.** The Israel median of $9.15 is a broad, mixed-objective, mostly cold-audience median. A B2B niche campaign with a warm closed pool, feed-only placements and a conversation goal would be expected to sit above it. 2x is plausible rather than alarming. The campaign's CPM (about $20) is close to the SuperAds global October 2025 median ($21.69).
- **Diagnosis steps for the agent:**
  1. **Split CPM by ad set.** If the warm ad set's CPM is much higher than the new-audience ad set's, the small pool is the driver.
  2. **Split by placement** (FB feed vs IG feed). They often price differently; no source gave Israel-specific placement CPMs.
  3. **Plot CPM by day.** A rising CPM over consecutive days, together with rising frequency in the warm ad set, signals saturation.
  4. **Check overlap.** Does the Advantage+ "new audience" ad set exclude the warm custom audience? If not, the two ad sets can compete for the same designers and inflate both CPMs. A lookalike is only a "suggestion", so Advantage+ can expand into the warm pool.
  5. **Check relevance signals.** Read CTR and conversation rate alongside CPM: low engagement lowers estimated action rates, which raises effective cost.
- **Seasonality.** Q4 timing (late October, heading into November) likely adds some upward pressure. The SuperAds pattern suggests November is the peak and January the cheapest month. No Israel-specific Q4 2025 curve was found beyond the median already on file.
- **CPM is an input, not the goal.** For a messages campaign, the decision metric is cost per conversation (and, downstream, cost per real lead or booking from the CRM). A high CPM with an acceptable cost per conversation is fine; this is how experts frame it.

### Gaps
- I did not find Meta's own "About ad auctions" page in this research. The auction description comes from a secondary source.
- I found no Israel-specific Q4 seasonality data, CPM data by objective (messages vs traffic vs leads), or CPM data by placement.
- I found no credible, non-vendor CTWA CPM benchmark for Israel.

---

## 5. Fatigue and saturation signals: the classic triad, how many days of data, and Meta's own Creative Fatigue / Creative Limited diagnostics

### Takeaway
Meta still shows two creative-fatigue statuses in the Delivery column in 2025-2026:
- **"Creative limited"**: cost per result is higher than past ads but under 2x.
- **"Creative fatigue"**: cost per result is 2x or more.

These consider exposure of the same image or video across the Page's campaigns. Practitioners treat them as lagging indicators. They confirm fatigue only after costs have already doubled.

The practitioner early-warning pattern is rising frequency with falling CTR and rising CPM or cost per result, sustained over several days to a week. On a small warm audience, separate audience saturation (no new people left) from creative fatigue (people tired of this ad).

### Cited Findings
- **[META, described by PRACT, Sep 2025] Definitions.**
  - Creative Fatigue: "When Cost Per Result is at least twice as high as it's been in the past."
  - Creative Limited: "When Cost Per Result is higher than it's been in the past, but less than double."
  - Loomer says these definitions are simplified, that Meta doesn't explain how the drop is tied to exposure, and that the messages appear at the ad-set level.
  - Remedies: add new, varied ads, or turn off the ad set and start over. Running only one ad per ad set makes fatigue more likely. — [Jon Loomer, Creative Fatigue (15 Sep 2025)](https://www.jonloomer.com/creative-fatigue-meta-ads/)
- **[META wording as quoted by vendors] Scope of the statuses.**
  - "We consider all recent exposures of the ad's image or video, including those from other campaigns from your Page."
  - The labels appear most reliably for ad sets with a single creative. The pre-launch prediction applies only to single-creative ad sets and excludes Advantage+ catalog, dynamic creative and Advantage+ app campaigns.
  - Surfaced in search across [PPC Land, creative fatigue](https://ppc.land/creative-fatigue/) and [Admetrics, Meta creative fatigue & similarity score](https://www.admetrics.io/post/meta-creative-fatigue-and-similarity-score-complete-guide). Not verified on Meta's own page.
- **[VENDOR, Jun 2026] Atria's playbook.**
  - Creative Limited: prepare a replacement without pausing. It can also appear on new ads still ramping up, so wait 48 hours before acting.
  - Creative Fatigue: pause and replace.
  - Early signals: CTR falling consistently over 7 days, or CTR falling for 5 consecutive days while frequency rises; cost per result trending up with no targeting changes; more negative comments.
  - To confirm fatigue: performance should recover within 3-5 days after a creative swap.
  - Meta has no single public "creative fatigue score". Atria does not cite Meta for its definitions. — [Atria 2026](https://www.tryatria.com/blog/meta-creative-fatigue-diagnose-and-fix-2026)
- **[VENDOR, attribution not verified, low confidence] Numeric fatigue rule.** One vendor blog states that a CTR drop of 30% or more together with a CPM rise of 20% or more signals fatigue, and that prospecting deteriorates above about 3.5 per week. — surfaced in search among [Stackmatix](https://www.stackmatix.com/blog/meta-ads-frequency-management) / [AdStellar](https://www.adstellar.ai/blog/facebook-ads-frequency-too-high) / [nikhil.pro](https://nikhil.pro/ways-to-fix-ad-fatigue/)
- **[VENDOR] Audience saturation vs creative fatigue.** Vendor blogs distinguish:
  - **audience saturation**: the relevant people in the pool have been exhausted;
  - **creative fatigue**: the ad has gone stale even though new people remain.
  - Retargeting campaigns "always run at higher frequency" by nature, so each campaign type should be judged against its own norm. — surfaced in a Hebrew-language search across [Stackmatix](https://www.stackmatix.com/blog/meta-ads-frequency-management) / [SmartAds](https://smartads.tech/blog/detail/what-is-ad-fatigue-signs-causes-and-effective-ways-to-overcome-it-Fi4tFVdYc1NcWQ==.html)
- **[PRACT, 2018] Heath's three fixes:**
  1. "Significantly change your ad". A new format, not just a new headline: "just changing the headline or copy, isn't enough."
  2. A new audience.
  3. A new offer. — [Heath Media](https://heathmedia.co.uk/?p=373542)
- **[PRACT] Diagnosis.** Check the Delivery column for Creative Fatigue / Learning Limited flags, then use the day breakdown and Activity History. — [Jon Loomer, Why Won't Meta Spend](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)

### Inferences
- **The warm ad set is the exposed one.** It is a closed pool of about 3,000, on feed placements only, with the same 4 carousels shown again (also in the new-audience ad set; Meta counts Page-wide exposures of the same image). It is structurally the most fatigue-prone. Four ads per ad set is better than one (Loomer), but the same four images run in both ad sets.
- **Minimum data before calling fatigue (synthesis, not a Meta rule):**
  - at least 5-7 days of daily data per ad set;
  - a consistent direction, meaning 7-day frequency rising, CTR falling, and CPM or cost per conversation rising across the period, not a single bad day.
  - At 5 days in, it is too early to call fatigue. It is the right time to establish the baseline.
- **Statistical caution at the ad level.** Per-ad reach is only 145-214 in the warm ad set, so per-ad CTR and conversation comparisons are noisy. Read trends at the ad-set level and treat per-ad differences as indicative only. A community forum opinion says 100 impressions "isn't enough to tell much"; that is user opinion, not a test. — [Moz Q&A](https://mozdev.nodebb.com/community/q/post/32789)
- **Saturation signature to code into the agent:**
  - ad-set new reach per day trending to about 0;
  - 7-day frequency rising;
  - CPM rising;
  - under-spend of the ad-set budget.
- **Creative fatigue signature to code into the agent:**
  - new reach still growing (or stable);
  - CTR falling and cost per conversation rising on a specific ad;
  - the Delivery column showing Creative limited or Creative fatigue.
- **What each signature calls for:**
  - Saturation calls for a smaller budget or a larger pool, for example widening the warm audience definition.
  - Creative fatigue calls for new images or format.
  - Under the project's safety rules, both are only recommendations to the user.

### Gaps
- I could not open Meta's own Help Center article on Creative Fatigue / Creative Limited, so exact current wording and scope are secondhand.
- A claim that Meta removed its "six creatives per ad set" recommendation from its ad volume help article in July 2025 appeared in search results but was not verified.
- I found no research-grade figure for "how many days of data" before declaring fatigue. The 48-hour, 5-day, 7-day and 3-5-day figures are vendor heuristics.

---

## 6. What a professional daily and weekly delivery check looks like

### Takeaway
I found no single authoritative checklist. Practitioners converge on these checks:
- **Daily (quick):** pacing per ad set, Delivery column flags, CPM, frequency and CTR direction.
- **Weekly (decision):** 7-day frequency and reach per ad set, cost per result trend, fatigue or saturation calls, overlap, and creative refresh decisions.
- Judge on weekly windows because of Meta's weekly budget balancing. Avoid daily tinkering that resets learning.

### Cited Findings
- **[VENDOR / open-source tool] Meta Ads Kit's five morning questions:**
  1. Is spend on pace against today's budget?
  2. What is active?
  3. How is 7-day performance?
  4. Which ads are winning and losing?
  5. Is anything fatiguing? This watches CTR trend, frequency and CPC movement.

  Defaults: frequency ceiling 3.5, minimum CTR 1.0%, spend-pacing alert 15%. These are tool defaults. — [Meta Ads Kit, daily questions](https://mintlify.wiki/TheMattBerman/meta-ads-kit/concepts/daily-questions)
- **[PRACT] Loomer's under-delivery check:** Delivery column flags, then breakdown by day, then Activity History, then automated rules and spending limits. — [Jon Loomer, Why Won't Meta Spend](https://www.jonloomer.com/why-wont-meta-spend-my-advertising-budget/)
- **[PRACT] Loomer on not over-reacting to frequency:** act on frequency only when results decline. — [Jon Loomer, Creative Fatigue](https://www.jonloomer.com/creative-fatigue-meta-ads/)
- **[PRACT, 2018] Heath on the same point:** act on frequency only when results decline. — [Heath Media](https://heathmedia.co.uk/?p=373542)
- **[VENDOR/agency] Enrich Labs.** It describes a morning checklist "run every morning without disrupting delivery", plus guidance on which budget edits trigger the learning phase. The details were not extracted. — [Enrich Labs, Meta Ads Manager Workflows 2026](https://www.enrichlabs.ai/blog/meta-ads-manager-workflows-2026)
- **[META via PRACT] Budget edits and learning.** Meta suggested an in-product budget increase (example: $100 to $179, +79%) "without re-entering the learning phase". Loomer assumes this applies to campaign-level Advantage budgets and could not confirm it for ad sets. — [Jon Loomer, Updates to Meta Ads Budgeting](https://www.jonloomer.com/updates-to-meta-ads-budgeting/)

### Inferences
- **Proposed delivery checks for the ads-analyst agent.** This is synthesized from the cited sources plus the campaign's structure; the thresholds are heuristics to present as such.
- **Daily (per ad set, not just campaign totals):**
  1. Spend today and week-to-date vs budget x days. Under the 75% / 7x rule, flag only week-to-date deviations beyond about 15%, or 3 or more consecutive under-spend days.
  2. Delivery column status: Learning / Learning Limited / Creative limited / Creative fatigue.
  3. CPM today vs the ad set's own 3-day and 7-day average. Flag rises of 20% or more sustained for 3 or more days (a vendor-level heuristic).
  4. Daily new reach for the warm ad set: cumulative reach today minus yesterday.
  5. CTR (link clicks to WhatsApp) and conversations started.
- **Weekly (decision layer):**
  1. Ad-set 7-day reach, 7-day impressions and 7-day frequency, pulled as one 7-day range. Never sum per-ad or per-day reach.
  2. Warm penetration: ad-set lifetime reach / matched audience size, plus whether the cumulative reach curve is flattening.
  3. CPM, CTR and cost per conversation trends week over week. Classify each as saturation vs creative fatigue vs normal.
  4. Overlap check: does the new-audience ad set exclude the warm audience?
  5. Placement split (FB feed vs IG feed): CPM and cost per conversation.
  6. Recommendation list for the user, such as budget shifts, new creative or audience changes. Following project rules, nothing is changed in Meta by the agent.
- **What the current agent misses.** It looks at total spend, total frequency and spend per ad. The biggest missing pieces are ad-set-level reach and frequency, 7-day windows, the daily new-reach curve, CPM trend by ad set, the Delivery-column statuses, and pacing against the weekly cap.

### Gaps
- I found no Hebrew or Israeli agency source on retargeting frequency, CPM or delivery checklists. A Hebrew search returned only international vendor content.
- I found no published daily or weekly checklist from Andrew Foxwell, Depesh Mandalia, Savannah Sanchez or Common Thread Collective within this research budget. Their views on these exact delivery metrics remain unverified here.
