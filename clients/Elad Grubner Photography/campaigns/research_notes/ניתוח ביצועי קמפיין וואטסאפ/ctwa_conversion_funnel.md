# CTWA conversion funnel: from ad click to closed deal - what Meta counts, what it misses, how pros measure quality offline

Research date: 26 Oct 2026. Web research only (no Meta API calls, no project tools, no .env).
Source labels used below: **[OFFICIAL]** = Meta / WhatsApp / Meta for Developers; **[VENDOR]** = company selling CTWA/messaging/CRM software or services; **[INDEPENDENT]** = academic / press / data-connector docs not selling CTWA; **[SECONDARY]** = summary of someone else's study.
Important caveat on sourcing: several Meta Business Help Center pages (2038363993156008, 200322347047101) did not render for the fetch tool (only the title came back). Their definitions below are taken from a third party that quotes them, and are marked as such.

---

## Q1. Which messaging action types does Meta report for CTWA ads, how is each defined, which are reliable, and what are the attribution windows?

### Takeaway
Meta's CTWA reporting stops at the very top of the funnel: "conversation started" (a person sent a message after 7+ days of no messaging with the business, attributed to the ad) plus a few side metrics (new contacts / "first reply", new messaging connections, blocks). Nothing Meta reports for a WhatsApp Business **app** advertiser tells you whether the business replied, how deep the chat went, whether the lead is relevant, a quote, or a deal - those require either the Business app's lead/purchase signals or Conversions API for Business Messaging (API-only). Note the naming trap: `messaging_first_reply` is the *customer's* first message as a new contact, not the business's reply.

### Cited Findings
**Conversations started (`onsite_conversion.messaging_conversation_started_7d`)**
- Meta's definition (as quoted from Meta Business Help Center "Messaging conversations started"): the number of times people started messaging the business after at least 7 days of no messaging activity, attributed to the ads; covers Messenger, Instagram Direct and WhatsApp Business; includes first-time and returning contacts; **Meta labels this metric "in development"** — [Adams Analytics, 4 Oct 2026, citing facebook.com/business/help/2038363993156008](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads) [VENDOR/agency quoting OFFICIAL]
- It is the default result of Messages-objective campaigns: Adverity lists the `MESSAGES` objective's result as `actions.onsite_conversion.messaging_conversation_started_7d` — [Adverity docs](https://docs.adverity.com/reference/connectors/connector-facebook-ads.html) [INDEPENDENT connector docs]
- Third-party glossaries disagree on what "7d" means: Adverity frames it as a 7-day click attribution window, while Meta's help text frames it as the 7-day inactivity rule — [Adverity docs](https://docs.adverity.com/reference/connectors/connector-facebook-ads.html); [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads). (Conflict noted; the inactivity rule is the one quoted from Meta.)
- Dataddo labels it "Onsite conversion - messaging conversation start (count)" = "Count of unique conversations started on messenger in the last 7 days" — [Dataddo field reference](https://docs.dataddo.com/docs/facebook-ads-fields-references) [INDEPENDENT connector docs]

**"First reply" (`onsite_conversion.messaging_first_reply`)**
- Dataddo labels it "Onsite conversion - messaging conversation **new** (count)" = "Count of users who started a new conversation with the business on messenger"; cost field = "average cost for each new messaging conversation started" — [Dataddo](https://docs.dataddo.com/docs/facebook-ads-fields-references)
- Other glossaries describe it as "the event indicating when a user sends the first reply in a conversation directly on Facebook platforms", and a windowed variant `messaging_first_reply.1d_click` exists — [search summary of Adverity/Dataddo glossaries](https://docs.adverity.com/reference/connectors/connector-facebook-ads.html)
- Both descriptions are about the **user's** first message (new contact), not the business answering. (Ads Manager's UI column for this is commonly "New messaging contacts"; I could not load an official Meta page confirming the UI label - see Gaps.)

**Messaging connections / blocks / replies**
- "New messaging connections" = people added as messaging connections, attributed to ads; "Cost per new messaging connection" = spend / new connections — [Adams Analytics citing Meta help 200322347047101 and 1003979519710721](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads); [Metric Labs glossary](https://metriclabs.com.au/glossary/facebook-metrics/new-messaging-connections/) [VENDOR]
- "Messaging connections" = number of people a Page can send messages to (Meta help center, per search snippet; page body did not render) — [Meta Business Help: About insights for the Messages objective](https://en-gb.facebook.com/business/help/200322347047101) [OFFICIAL, snippet only]
- "New blocked messaging connections" = times people blocked the business, attributed to ads; rising blocks suggest reaching people who don't want to hear from you — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- `onsite_conversion.messaging_block` exists as an action type; Dataddo's description ("users who have completed a conversation") is evidently wrong for a block metric — treat that connector glossary with caution — [Dataddo](https://docs.dataddo.com/docs/facebook-ads-fields-references)
- "Messaging replies" = number of messaging replies users sent to a business from **Facebook Messenger** attributable to ads (Messenger-only per glossary) — [Metric Labs](https://metriclabs.com.au/glossary/facebook-metrics/messaging-replies/) [VENDOR]
- Messenger-specific action types `messenger.reply` and `messenger.block` are reported with 1d_click, 1d_view, 7d_click, 28d_click windows and an "incrementality" variant — [Adverity docs](https://docs.adverity.com/reference/connectors/connector-facebook-ads.html)

**What Meta does NOT count / known gaps**
- Ads Manager counts fewer conversations than the business's inbox: only ad-attributed conversations, one per person per 7 days of inactivity; repeat messages within a week and chats from other sources are not counted — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- "Conversations are not sales": Meta's count stops when a conversation starts; replies, response speed and orders happen in the business's inbox — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- Without a distinct pre-filled message per campaign, the business may not know which campaign a chat came from — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- Advertisers "sometimes see differences between Meta's messaging metrics and the conversations their teams actually see"; recommendation is to compare the two regularly — [Wisemelon, 6 Aug 2026](https://wisemelon.ai/blog/click-to-whatsapp-ads-clicks-but-no-messages/) [VENDOR]
- Meta's "conversations started" includes people who go silent immediately after the first message, so it overstates qualified leads — [vendor guide set incl. AsisteClick/Rework (search summary)](https://asisteclick.com/en/blog/click-to-whatsapp-ads-ctwa-conversion-2026/) [VENDOR]
- Default Ads Manager WhatsApp result counts chats started, not leads or sales — [respond.io](https://respond.io/blog/click-to-whatsapp-ads) [VENDOR, via search summary]

### Inferences
- **Step-by-step map (what Meta can see for a WhatsApp Business app advertiser):**
  1. Tap on WhatsApp button -> Meta sees a click (but "Clicks (all)" is polluted with non-link interactions, see Q2). No dedicated "tapped WhatsApp CTA" metric was found in sources.
  2. Conversation started -> `messaging_conversation_started_7d` (Meta-counted, "in development", inactivity-based, attributed to ad).
  3. "First reply" -> `messaging_first_reply` = the customer is a NEW contact sending a first message; it is NOT Elad replying. In Elad's day-5 data (2 started = 2 first reply) this most likely means both chats were from brand-new contacts, not that Elad answered both.
  4. Business reply / conversation depth -> not reported to a Business app advertiser in any source found (depth metrics - see Gaps).
  5. Qualified lead / quote / deal -> invisible to Meta unless the business sends events back (Business app lead/purchase signals or CAPI for Business Messaging, Q3).
- Reliable-for-decision ranking: conversations started (directional, Meta's own result but marked "in development") > new contacts/first reply (useful to see new vs returning) > blocks (warning signal) > Clicks (all) (not a funnel step). Everything below "conversation started" must come from Elad's manual log.
- Private messages from designers who saw the ad but messaged Elad directly (not via the button) are in the "chats from other sources are not counted" bucket - they should be logged as "ad-influenced, not attributed" in Elad's log, not dropped.

### Gaps
- Could not find an official or third-party source defining `onsite_conversion.messaging_user_depth_2_message_send`, `..._depth_3_message_send`, `onsite_conversion.total_messaging_connection`, `messaging_conversation_replied_7d` ("Messaging conversations replied"), or `messaging_welcome_message_view`. Their existence/meaning for WhatsApp in 2025-2026 is unverified here. A practical check (not done, out of scope): look at which action_type keys actually appear in the raw `actions` array the team already pulls for this campaign.
- Could not load Meta's own help pages (body did not render), so the official wording of "in development" and of the "New messaging contacts" UI label is via a third party.
- No source found that confirms a Meta metric for "tapped the WhatsApp CTA but did not send"; and no source on which messaging action types are deprecated as of 2026.

---

## Q2. What is a typical click-to-conversation and conversation-to-reply rate, and why can 108 clicks give only 2 conversations?

### Takeaway
There is no credible, independent benchmark for click-to-conversation or conversation-to-reply rates on CTWA; published figures are vendor examples or heuristics. The biggest technical reason for 108 -> 2 is the denominator: "Clicks (all)" counts every interaction (likes, profile taps, expanding media, comments), not taps on the WhatsApp button; the remaining drop is the user having to actually send the message after the app switch.

### Cited Findings
**Why clicks don't become conversations**
- "Clicks (all)" covers any click, including opening comments or liking the post; non-link clicks include expanding a photo/video to full screen — [Motion glossary](https://motionapp.com/library/glossary/click); [Reportei](https://reportei.com/en/?p=83838) [VENDOR glossaries]
- Link clicks = clicks on links to selected destinations or experiences on or off Meta (includes some internal Meta destinations) — [Motion glossary](https://motionapp.com/library/glossary/click)
- 2026 change: Meta's click-through attribution for website and in-store conversions now counts only link clicks; non-link interactions move to "engage-through attribution"; billing unaffected. Sources describe attribution, not the Clicks (all) column, and do not address messaging ads — [Avenue Z](https://avenuez.com/blog/metas-new-definition-of-click/); [CMOtech UK](https://cmotech.uk/story/meta-refines-ad-click-metrics-with-engage-through-shift) [SECONDARY/agency]
- The user must send the first message; opening WhatsApp is not enough; people click out of curiosity, change their mind once the app opens, or get distracted — [Wisemelon, 6 Aug 2026](https://wisemelon.ai/blog/click-to-whatsapp-ads-clicks-but-no-messages/) [VENDOR]
- Other listed causes: blank chat with no pre-filled text adds friction; optimizing for cheap clicks instead of conversations; curiosity-bait creative; slow first reply (example: customer waits 20 minutes and loses interest); generic greeting that ignores the ad; technical issues (wrong number connected, CTA opens wrong account, mobile display issues, WhatsApp Business account not working normally, automations not triggering) — [Wisemelon](https://wisemelon.ai/blog/click-to-whatsapp-ads-clicks-but-no-messages/)
- Recommended KPI: Conversation Start Rate = actual conversations started / eligible ad clicks, tracked separately from Meta's figure — [MRAI Labs, 12 Oct 2026](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/) [VENDOR]
- Heuristic: a conversation start rate below 30% suggests the pre-filled message is not being sent / audience mismatch — [vendor guide in AsisteClick/Rework search set, exact page not verified](https://asisteclick.com/en/blog/click-to-whatsapp-ads-ctwa-conversion-2026/) [VENDOR, single unverified heuristic]

**Numbers that exist (all illustrative, not benchmarks)**
- Wisemelon's illustrative funnel: 1,000 clicks -> 500 conversations (50%) -> 180 qualified (36%) -> 40 sales (22% of qualified; 4% click-to-sale). Explicitly an example, no data source — [Wisemelon](https://wisemelon.ai/blog/click-to-whatsapp-ads-clicks-but-no-messages/)
- MRAI Labs gives no benchmark rates for click-to-conversation, reply, qualification or close; its EGP 10,000 -> 500 messages -> 100 qualified example is hypothetical — [MRAI Labs](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/)
- Adams Analytics gives no industry benchmarks (its 15 EGP/conversation and 125 EGP/order are examples) — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- Macro context only: Meta reported US click-to-message ad revenue grew >50% YoY in Q4 2025 and paid WhatsApp messaging passed a $2B annual run rate (Meta, Jan 2026, as cited by MRAI Labs) — [MRAI Labs](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/)
- Already established in earlier research (not redone): no independent public CTWA benchmark exists (Kanal, May 2026).

### Inferences
- Elad day 5: 2 / 108 Clicks (all) = 1.9%. This number is not a valid "click-to-conversation rate" because the denominator mixes carousel interactions, likes, profile taps and media expands with real WhatsApp taps. The right denominator is link clicks (or outbound/CTA clicks if available); the ratio should be recomputed on that before concluding the pre-filled message is broken.
- Carousel format inflates Clicks (all) more than single-image ads because there are more interactive elements per ad (inference; no source found specifically on carousel swipes being counted - see Gaps).
- Other plausible drop-off reasons for an Israeli B2B audience (inference, unsourced): desktop viewers without WhatsApp desktop linked; viewers who tap to look at the portfolio/profile rather than to chat; designers who prefer to message privately later (Elad already observed this - it moves conversions out of Meta's count, not out of reality).
- Conversation-to-"first reply" in Elad's data (2 of 2) should not be read as a reply rate (see Q1 - it is "new contacts").
- With 2 conversations, any rate is statistically meaningless; a vendor 30%/50% heuristic cannot be confirmed or refuted on this volume.

### Gaps
- No credible (official or independent) number for typical CTWA click-to-conversation, conversation-to-reply, or per-step "normal drop". Only vendor examples exist.
- No source confirms whether carousel card swipes count in "Clicks (all)" or whether the WhatsApp CTA tap counts as a "link click" for messaging ads.
- No source quantified app-switch drop-off, WhatsApp-not-installed, or desktop share for CTWA.

---

## Q3. How do experts define and measure lead quality for messaging leads, and is sending lead/purchase events back to Meta feasible for a tiny advertiser (~1-5 leads/week)?

### Takeaway
Lead quality is measured outside Meta (labels/tags, a qualification step, a log/CRM), then optionally sent back. The official route back - Conversions API for Business Messaging - is documented only for the WhatsApp Business **Platform** (Cloud API), needs a developer app, advanced permissions and in practice a messaging partner, so it is not realistic for a Business **app** user with a few leads a week. The Business app route (lead optimization fed by lead signals in the app) exists and Meta reports a 24% lower cost per lead vs conversation optimization, but needs a volume threshold (10+ lead events/30 days, from earlier research) that a 1-5 leads/week B2B niche would barely meet, if at all.

### Cited Findings
**Conversions API for Business Messaging (official spec)**
- Lets Business Messaging Partners send messaging events from their servers for ads that click to WhatsApp, Messenger or Instagram; events should reflect interactions inside the message thread — [Meta for Developers: CAPI for Business Messaging](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging) [OFFICIAL]
- Required: `action_source: business_messaging`, `messaging_channel: whatsapp`, dataset_id, access token, partner_agent; for WhatsApp with click ID: `whatsapp_business_account_id` + `ctwa_clid`; without click ID: `page_id` + WABA ID + at least one SHA-256 hashed customer parameter (e.g. phone) — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Supported event names: Purchase, LeadSubmitted, InitiateCheckout, AddToCart, ViewContent, OrderCreated, OrderShipped, OrderDelivered, OrderCanceled, OrderReturned, CartAbandoned, **QualifiedLead**, RatingProvided, ReviewProvided — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Covers only WhatsApp Business Platform (Cloud API recommended, or On-Premises API whose final client version expired 23 Oct 2025); the WhatsApp Business **app** is not mentioned — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Timing: with `ctwa_clid` no time limit stated; hashed-customer path attributes only to ad interactions in the past 7 days (later events accepted but not attributed) and is available only in a subset of countries — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Purchase optimization available for Messenger and WhatsApp; no minimum event volume stated; Meta does not deduplicate - advertisers must dedupe — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Eligibility: Facebook developer app, advanced access to `whatsapp_business_management` and `whatsapp_business_manage_events`, Marketing API access tier thresholds (page states both 1,500 calls/15 days and a newer 500-call threshold - conflicting), Embedded Signup or Facebook Login for Business — [Meta for Developers](https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging)
- Vendor framing: the click ID from the ad is what links the event to the ad; using a generic "website" action_source stops Meta from linking it — [Chatfuel / vendor set (search summary)](https://chatfuel.com/blog/whatsapp-conversions-api-ctwa-ads) [VENDOR]; Chatfuel (15 Sep 2026) recommends sending Lead, Schedule and Purchase events — [Chatfuel](https://chatfuel.com/blog/whatsapp-conversions-api-ctwa-ads)

**Lead / purchase optimization for CTWA (WhatsApp official pages)**
- Lead-optimized CTWA ads deliver to people most likely to connect and share contact info; in an experiment of 116K campaigns across 43K businesses (4-10 Nov 2024) they drove **24% lower cost per lead** vs ads optimized for conversations — [WhatsApp Business: Lead generation strategies for SMBs](https://whatsappbusiness.com/resources/resource-library/lead-generation-strategies-smb-whatsapp/) [OFFICIAL, Meta-run test]
- Purchase-optimized messaging ads drove **10% lower cost per purchase** vs conversation optimization (week-long global study, H2 2024, no sample size given) — [WhatsApp Business: Down-funnel optimizations](https://whatsappbusiness.com/resources/resource-library/down-funnel-optimizations-whatsapp/) [OFFICIAL]
- Lead optimization not available in the EU, UK, Japan or South Korea (Israel not excluded) — [WhatsApp Business SMB page](https://whatsappbusiness.com/resources/resource-library/lead-generation-strategies-smb-whatsapp/)
- Setup conflict between two official pages: one says Engagement objective -> Messaging apps -> WhatsApp -> performance goal Leads — [SMB page](https://whatsappbusiness.com/resources/resource-library/lead-generation-strategies-smb-whatsapp/); the other says choose the Leads objective, conversion location Messaging destinations -> WhatsApp — [Down-funnel page](https://whatsappbusiness.com/resources/resource-library/down-funnel-optimizations-whatsapp/)
- "Once you've met the eligibility criteria, you'll see the option to optimize for your business goal in Ads Manager" - criteria not listed on the page — [Down-funnel page](https://whatsappbusiness.com/resources/resource-library/down-funnel-optimizations-whatsapp/)
- Learning phase: a vendor guide says new ad sets need ~50 optimization events within 7 days to exit learning — [AdLibrary, 2026](https://adlibrary.com/posts/meta-click-to-whatsapp-ads-guide) [VENDOR]

**Labels / automatic events in the Business app (unverified vendor claims)**
- The free WhatsApp Business app has predefined labels (e.g. New customer, New order, Pending payment, Order complete) — [vendor search set incl. Strike Digital / respond.io](https://strikedigitalgroup.com/en/new-whatsapp-business-label-feature/) [VENDOR, not fetched]
- One guide: in the Business app, turn on event sharing and apply the app's predefined lead and order labels within 7 days of the click — [vendor search set incl. clubunbrick.co](https://clubunbrick.co/blog/track-which-ads-drive-whatsapp-leads/) [VENDOR, not fetched, unverified]
- Meta can detect lead and purchase events in threads that started from a CTWA ad; this is opt-in — [vendor search summary (AsisteClick/eGrow/Wati set)](https://www.wati.io/en/blog/set-up-click-to-whatsapp-ads/) [VENDOR, unverified]
- Counter-claim: Meta's automatic events for ad optimization "is only available for ads that click to Messenger and Instagram Direct at this time" — [vendor search summary (respond.io set)](https://respond.io/blog/click-to-whatsapp-ads) [VENDOR, date unknown, may be outdated]

**Defining quality (practitioner frameworks)**
- Funnel stages used by practitioners: ad click -> conversation started -> useful first response -> qualified conversation -> next step reached -> follow-up -> business outcome; KPIs: conversation-to-qualified rate, follow-up coverage (followed-up / due), cost per qualified conversation, cost per next step, CAC — [MRAI Labs](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/) [VENDOR]
- Tiered event scheme: Tier 1 lead-quality events = Conversation Started, Qualified Lead, Showed Purchase Intent; then purchases / booked appointments — [vendor 2026 guide (search summary)](https://adlibrary.com/posts/meta-click-to-whatsapp-ads-guide) [VENDOR]
- Business-supplied metrics (orders from chat, cost per order = spend / orders from chat) come from the client's records, not Meta — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)

### Inferences
- For Elad (Business app, ~1-5 conversations/week, 1-2 relevant): sending events back via CAPI is **not feasible** without migrating the number to the WhatsApp Business Platform through a partner - disproportionate for this volume. The Business-app lead-optimization path is technically closer but volume-starved (10+ lead events in 30 days is ~2.5/week of *lead-labeled* chats; relevant designers alone may not reach it), and even if eligible, optimizing on so few events risks learning on noise.
- If the team ever labels chats in the app, the label "lead" should mean "relevant designer/architect who described a real project", not "anyone who wrote" - otherwise Meta would optimize toward the same cheap, low-quality conversations.
- The manual log Elad already keeps (who / status / amount) is exactly the "business-supplied" layer practitioners recommend; it should gain: date of first message, source (button vs private message vs other), date of quote, date of close, amount.

### Gaps
- No official Meta page found (that rendered) describing exactly how WhatsApp Business **app** labels / event sharing feed Ads Manager reporting or lead optimization in 2026, or the exact eligibility threshold. The 10+ lead events/30 days figure is from earlier research, not re-verified here.
- No source on whether lead events from the Business app appear as a reportable column (e.g. "Messaging leads") in Ads Manager.

---

## Q4. How do B2B / service businesses with long sales cycles judge a messaging campaign?

### Takeaway
Practitioners judge messaging campaigns on down-funnel unit costs computed from their own records - cost per qualified conversation, cost per next step (quote/meeting), CAC and revenue vs spend - not on Meta's cost per conversation. No source was found giving a specific minimum follow-up window or a cohort method tailored to CTWA; these are standard B2B practice applied by inference.

### Cited Findings
- Cost per conversation is not cost per sale; the conversation count stops where the business process starts — [Adams Analytics](https://meta.buildincairo.com/blog/measure-whatsapp-messenger-ads)
- Formulas: Conversation Start Rate; Conversation-to-Qualified Rate; Follow-up Coverage; Cost per qualified conversation = spend / qualified conversations; Cost per next step = spend / targeted next steps completed; CAC = total acquisition cost / new customers; contribution margin before acquisition cost — [MRAI Labs, 12 Oct 2026](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/)
- MRAI's illustrative comparison: Campaign B has a higher cost per conversation but lower cost per booking and per new customer (labelled "illustrative only") - the point being that the cheaper-per-chat campaign can be the worse campaign — [MRAI Labs](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/)
- Diagnosis rule: low start rate -> problem in ad / pre-filled message / audience; healthy start rate but weak follow-through -> problem in reply flow and reply speed — [vendor guide set (search summary of AsisteClick/MRAI/Rework)](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/) [VENDOR]
- Meta-run case data (context, not B2B): retailers in a Meta / Retailers Association of India study (Feb 2026) averaged 62% more leads, 61% better ROAS, 22% higher order values — [as cited by MRAI Labs](https://mrailabs.com/en/blog/click-to-whatsapp-ads-conversation-funnel-roi-en/) [OFFICIAL via SECONDARY, retail, India]

### Inferences
- For Elad, the relevant funnel units are: spend -> conversations (Meta) -> relevant designer/architect conversations (log) -> quotes sent (log) -> shoots booked + amount (log). Day 5: 283.83 ILS / 2 conversations = ~142 ILS per conversation; 283.83 ILS per relevant designer (1); 0 quotes, 0 deals.
- Cohort by lead date, not close date: each conversation should be attributed to the week it started (and to the campaign/ad set), and its quote/close outcome filled in later. Revenue from a shoot closed in February belongs to the October cohort that generated it. Report cumulative "revenue per ILS spent" per cohort at fixed checkpoints (e.g. 30/60/90/180 days after lead date) - standard long-cycle practice, no CTWA-specific source found.
- Because one shoot day is worth thousands of ILS, a single closed deal can repay months of 75 ILS/day spend (~2,250 ILS/month); this makes "cost per relevant conversation" and "quotes sent" the most useful early indicators, with revenue judged only after the sales-cycle lag.
- Private messages from designers who saw the ad should be tracked as a separate "ad-influenced" line (not in Meta's count, but real value); asking "where did you see me?" in the first reply is the low-tech attribution method.

### Gaps
- No source found on a recommended minimum follow-up period before judging a B2B CTWA campaign, or on typical time-to-close for B2B service leads from messaging.
- No source on lead-date vs close-date cohort reporting specifically for messaging ads.
- No Hebrew/Israeli agency source on measuring WhatsApp campaign lead quality was found (Hebrew search returned only WhatsApp product news).

---

## Q5. Speed-to-lead: does reply time affect conversion for WhatsApp / messaging leads?

### Takeaway
The best evidence (HBR 2011; InsideSales/MIT Lead Response Management study) shows a steep decline in qualification as response delay grows, but it is about web-form leads contacted by phone/email, not WhatsApp, and it is correlational. WhatsApp-specific numbers exist only from vendors without published methodology.

### Cited Findings
- HBR "The Short Life of Online Sales Leads" (Oldroyd, McElheran, Elkington, 2011): firms that tried to contact a lead within an hour were nearly 7x as likely to qualify it as firms that tried even an hour later, and more than 60x as likely as firms that waited 24+ hours; data = 1.25M leads from 42 US companies (29 B2C, 13 B2B) — [HBR (original)](https://hbr.org/2011/03/the-short-life-of-online-sales-leads); summarized in [AInora](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026) and [Lean Discovery Group](https://www.leandiscoverygroup.com/post/lead-response-time-research) [INDEPENDENT via SECONDARY]
- Same HBR work audited 2,241 US firms: 37% responded within 1 hour, 16% within 1-24 hours, 24% after 24+ hours, 23% never — [secondary summary (search set)](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026) [SECONDARY, verify against HBR PDF]
- The "5 minutes: 100x contact / 21x qualification vs 30 minutes" figures are from the 2007 Lead Response Management study (InsideSales.com with Dr. James Oldroyd, MIT; >100,000 contact attempts with internet leads), often misattributed to HBR — [Lean Discovery Group](https://www.leandiscoverygroup.com/post/lead-response-time-research); [AInora](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026) [SECONDARY]
- Caveat: fast responders may differ in staffing/process; the studies show correlation, not causation — [Lean Discovery Group](https://www.leandiscoverygroup.com/post/lead-response-time-research)
- WhatsApp-specific vendor claim: leads answered in under 90 seconds reach ~8-12% purchase conversion in e-commerce vs ~2-3% when response takes over 5 minutes (~4x); "aggregated", no sample or method shown — [Aurorainbox, 28 May 2026](https://www.aurorainbox.com/en/2026/05/28/whatsapp-conversion-response-time-2026/) [VENDOR, unverifiable]
- Single SaaS case: leads who got a reply within 5 minutes were 3x more likely to book a call — [Rasayel](https://learn.rasayel.io/en/blog/boost-sales-with-whatsapp-analytics/) [VENDOR, anecdote]
- Messaging-specific practitioner advice: a reply 20 minutes later misses the moment of interest; use an instant automated reply that references the ad — [Wisemelon](https://wisemelon.ai/blog/click-to-whatsapp-ads-clicks-but-no-messages/) [VENDOR]

### Inferences
- For Elad, the greeting message already provides an instant automated touch; the measurable item is time from customer's first message to Elad's first personal reply. Adding "first reply time" (minutes/hours) as a log column would let the team see, over months, whether slow replies correlate with lost leads - with the strong caveat that B2B designers on a months-long cycle are less time-sensitive than e-commerce buyers.
- Because Meta does not report the business's reply time for Business-app advertisers (Q1), this can only come from the manual log.

### Gaps
- No independent, methodologically transparent study of response time vs conversion for WhatsApp or click-to-message leads; no B2B-messaging-specific data.
- HBR's 2,241-firm audit numbers were taken from a secondary summary, not checked against the original PDF.
