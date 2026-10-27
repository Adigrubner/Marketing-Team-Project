# Meta Marketing API Insights for a Click-to-WhatsApp Campaign: Fields, Breakdowns, Action Types and Limits (reference for extending a read-only Node.js reporting tool, as of 26 Oct 2026)

Scope note: web research only. No Meta API calls were made, no project tools were run, and no .env files were read. Meta has moved most Marketing API docs to `developers.facebook.com/documentation/ads-commerce/...` (Markdown pages). Several old `/docs/marketing-api/...` URLs now return 404, including the full Ads Insights field reference and the `/insights/parameters` page. Some field definitions below therefore come from the Campaign Insights reference page and the official Python SDK, not from a single "AdsInsights" page.

## 1. Current API version and 2025-2026 changes/deprecations that matter for Insights

### Takeaway
The latest version is **v26.0, released 29 Jul 2026**. **Marketing API v24.0 is available only until 10 Nov 2026**, so a tool pinned to v24.0 or older must move to v25.0 or v26.0 within about two weeks. The Insights changes that matter here:
- `7d_view` and `28d_view` return no data from 12 Jan 2026.
- `use_unified_attribution_setting` and `action_report_time` are ignored from 10 Jun 2025.
- Reach, unique and hourly data with breakdowns is limited to 13 months.
- `impression_device`, `frequency_value` and audience-time-zone hourly breakdowns need per-account enablement from 6 Aug 2026.
- `dma` is replaced by `comscore_market` from 22 Jun 2026.
- Three Delivery Estimate fields are removed on all versions on 27 Oct 2026.

No official rename of the messaging action types was found.

### Cited Findings
**Versions**
- Graph API versions table: v22.0 (21 Jan 2025), v23.0 (29 May 2025), v24.0 (8 Oct 2025), v25.0 (18 Feb 2026), v26.0 (29 Jul 2026, expiry "TBD"). Nothing is listed after v26.0. — [Graph API Versions](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- The Marketing API changelog gives different, shorter lifetimes: v26.0 introduced 29 Jul 2026 (available until TBD), v25.0 until 23 Feb 2027, v24.0 until 10 Nov 2026. — [Marketing API changelog](https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog.md)
  - Conflict: the Graph API versions table lists v24.0 expiring 18 Feb 2028. For Marketing API (ads/insights) endpoints, follow the Marketing API table.
- v25.0 was announced on 18 Feb 2026. — [Meta blog: Introducing Graph API v25 and Marketing API v25](https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/)
- 4 May 2026 (access tiers):
  - "Ads Management Standard Access" was renamed "Marketing API Access Tier".
  - The auto-approval threshold dropped from 1,500 to 500 Marketing API calls in 15 days.
  - Source: [Marketing API changelog](https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog.md)

**Insights changes, 2025 (out-of-cycle)**
- 10 Mar 2025 notice, applied to all versions on 10 Jun 2025:
  - `use_unified_attribution_setting` and `action_report_time` "will be disregarded". Responses mirror Ads Manager settings.
  - `reach` is no longer returned for breakdown queries whose start date is more than 13 months ago.
  - Source: [Out-of-cycle changes 2025](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025.md)
- 13 Oct 2025 notice, applied to all versions on 12 Jan 2026:
  - `7d_view` and `28d_view` attribution windows "will no longer be available and will return no data".
  - Unique-count breakdowns (e.g. `unique_actions`, `cost_per_unique_action_type`) and hourly breakdowns are "Limited to 13 months".
  - `breakdowns=frequency_value` is limited to 6 months.
  - `breakdowns=mmm` is limited to async jobs.
  - Source: [OCC 2025](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025.md)
- 29 Oct 2025: a new metric, `instagram_profile_visits` (profile visits resulting from ad interaction), was added at campaign, ad set and ad level. — [OCC 2025](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025.md)

**Insights changes, 2026**
- 8 May 2026 notice, effective 6 Aug 2026:
  - `impression_device` (and any combination containing it), `hourly_stats_aggregated_by_audience_time_zone` and `frequency_value` need enablement for certain ad accounts.
  - Without it they may return "no results", for both sync and async calls.
  - An admin can enable them in Ads Manager. After that, sync works from that day onward, and async jobs return the full history.
  - Those async jobs are throttled to "min(10, number_of_ad_groups) per 24 hours".
  - Source: [OCC 2026](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026.md)
- The same features are listed on the Breakdowns page under "Insights feature settings":
  - `GET /act_<ID>/insights/feature-settings/list-features` lists available features.
  - `GET /act_<ID>/insights/feature-settings` lists enabled features.
  - `POST /act_<ID>/insights/feature-settings` enables a feature. It takes up to about 24h, applies going forward only, and cannot be disabled through the API.
  - Source: [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns)
- 22 Jun 2026: `breakdowns=dma` is no longer supported. Use `comscore_market` instead. — [OCC 2026](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026.md)
- 13 Aug 2026: WhatsApp Marketing Messages are added to the Marketing API. The entry lists `GET /{ad-object-id}/insights` as affected but gives no details. — [OCC 2026](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026.md)
  - The SDK now exposes many `marketing_messages_*` insights fields (e.g. `marketing_messages_sent`, `marketing_messages_delivered`, `marketing_messages_read`). — [facebook-python-business-sdk adsinsights.py](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py)
- v25.0: failed async ad reports return five new default fields (`error_code`, `error_message`, `error_subcode`, `error_user_title`, `error_user_msg`). The type of `error_code` changes from uint to int. — [Marketing API v25.0 changelog](https://developers.facebook.com/documentation/ads-commerce/marketing-api/marketing-api-changelog/version25.0.md)

**v26.0 changes**
- Delivery Estimate, all versions on 27 Oct 2026: `daily_outcomes_curve`, `budget_guardrail` and `estimate_dau` "are removed from Delivery Estimate responses". "No replacement API is available." — [v26.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version26.0/)
- Placements:
  - Instagram Explore Feed is no longer available in v26.0+. Requests that specify it error.
  - The Messenger Stories `story` value in `messenger_positions` is silently removed (all versions, 27 Oct 2026).
  - Source: [v26.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version26.0/)
- Ads in WhatsApp Status: creatives can include `wamo_whatsapp_identity_spec` (v26.0+). Carousel ads now support up to 10 cards. — [v26.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version26.0/)

**Third-party reports**
- Third-party blogs widely report the 12 Jan 2026 view-window removal and estimate conversion drops of 15-40%. Those figures are not from Meta. — [Seresa](https://seresa.io/blog/attribution-measurement/meta-killed-its-28-day-view-attribution-window-on-january-12-2026); [Dataslayer](https://www.dataslayer.ai/blog/meta-ads-attribution-window-removed-january-2026)
- Some blogs also describe a March 2026 "engage-through" attribution change. It is **not found** in Meta's 2026 out-of-cycle page. — [goodmorningco (third party)](https://goodmorningco.com/blog/meta-attribution-changes-engage-through)

### Inferences
- The tool should check which API version it calls. If it is v24.0 or older, upgrade to v25.0 (safe until Feb 2027) or v26.0 before 10 Nov 2026.
- Do not request `7d_view` or `28d_view` windows; they return empty.
- Messaging action types are on-Meta (onsite) conversions. The off-Meta breakdown restrictions (Section 5) therefore should not remove them, but this is not explicitly stated for messaging.
- For a campaign that started in Oct 2026, the 13-month and 6-month history limits are irrelevant for now.
- New `publisher_platform` / `platform_position` values (e.g. for WhatsApp Status ads) may appear in breakdown output. Parse placement values as free strings; do not hardcode an enum.

### Gaps
- No official document found that renames `onsite_conversion.messaging_conversation_started_7d` or `onsite_conversion.messaging_first_reply` in 2025-2026.
- The v26.0 Marketing-API-specific changelog page (`.../marketing-api-changelog/version26.0.md`) was not in Meta's docs index. The v26.0 details come from the Graph API v26.0 changelog page.
- I could not confirm from Meta which attribution windows remain valid besides `1d_click`, `7d_click`, `28d_click` and `1d_view`. `1d_ev`, `dda` and `incrementality` are still listed as AdsActionStats fields (Section 3).

## 2. Exact field names and definitions (link clicks, CPM/CPC/CPP, unique, cost per action, quality rankings)

### Takeaway
All requested fields exist in the current SDK and reference.
- `inline_link_clicks` is the standard "Link clicks" metric. It uses a fixed 1-day-click window.
- `outbound_clicks` counts only clicks that leave Meta-owned properties.
- `cpm`, `cpc` (cost per click (all)), `cpp` (estimated) and `cost_per_inline_link_click` are separate fields.
- Ranking fields (`quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`) exist by name. Their official definitions and value enums could not be retrieved; the "500 impressions" threshold is confirmed only by third-party sources.

### Cited Findings
**Definitions from Meta's Campaign Insights reference** — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)
- **Link clicks**
  - `inline_link_clicks`: "The number of clicks on links to select destinations or experiences, on or off Facebook-owned properties." Uses a fixed 1-day-click attribution window.
  - `inline_link_click_ctr`: "The percentage of time Accounts Center accounts saw your ads and performed an inline link click."
  - `cost_per_inline_link_click`: "The average cost of each inline link click."
- **Outbound clicks**
  - `outbound_clicks`: "The number of clicks on links that take Accounts Center accounts off Facebook-owned properties."
  - `outbound_clicks_ctr`: percentage of times accounts saw the ad and performed an outbound click.
  - `cost_per_outbound_click`: "The average cost for each outbound click."
- **Clicks (all) and CTR**
  - `clicks`: "The number of clicks on your ads."
  - `ctr`: percentage of times accounts saw the ad and performed a click (all).
  - `cpc`: "The average cost for each click (all)."
- **Cost per impressions and reach**
  - `cpm`: "The average cost for 1,000 impressions."
  - `cpp`: "The average cost to reach 1,000 Accounts Center accounts. This metric is estimated."
- **Reach and frequency**
  - `reach`: "The number of Accounts Center accounts that saw your ads at least once." Estimated.
  - `frequency`: "The average number of times each person saw your ad. This metric is estimated."
- **Cost per action and unique costs**
  - `cost_per_action_type`: "The average cost of a relevant action."
  - `cost_per_unique_click`: "The average cost for each unique click (all). This metric is estimated."
  - `cost_per_unique_inline_link_click`: "The average cost of each unique inline link click. This metric is estimated."

**Field names in the official Python SDK (current main branch)** — [adsinsights.py](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py)
- Clicks and CTR:
  - `clicks`, `unique_clicks`, `unique_ctr`
  - `inline_link_clicks`, `inline_link_click_ctr`, `unique_inline_link_clicks`, `unique_inline_link_click_ctr`, `unique_link_clicks_ctr`
  - `outbound_clicks`, `outbound_clicks_ctr`, `unique_outbound_clicks`, `unique_outbound_clicks_ctr`
- Cost: `cpm`, `cpc`, `cpp`
- Rankings: `quality_ranking`, `engagement_rate_ranking`, `conversion_rate_ranking`
- Reach and frequency: `reach`, `full_view_reach`, `frequency`
- `cost_per_*` fields:
  - `cost_per_action_type`, `cost_per_unique_action_type`
  - `cost_per_inline_link_click`, `cost_per_unique_inline_link_click`
  - `cost_per_outbound_click`, `cost_per_unique_outbound_click`
  - `cost_per_unique_click`, `cost_per_result`, `cost_per_objective_result`
- Instagram: `instagram_profile_visits`
- Messaging-related: `messages_delivered`, `cost_per_message_delivered`, `onsite_conversion_messaging_detected_purchase_deduped`, and the `marketing_messages_*` family
- Video fields exist (e.g. `video_p25_watched_actions` ... `video_p100_watched_actions`, `cost_per_thruplay`). They are out of scope here.
- Same source, Level enum: `account`, `adset`, `campaign`, `ad`.

**Older Meta sources**
- Meta's 2016 developer blog:
  - `actions:link_click` "has the same definition" as inline link clicks but respects `action_attribution_windows`.
  - `clicks` (Clicks (all)) also includes likes, comments and event responses.
  - `cpc` was to be replaced by `cost_per_inline_link_click` for link-click cost.
  - Source: [Meta Ads Developer Blog, 16 Mar 2016](https://developers.facebook.com/ads/blog/post/2016/03/16/link-clicks-updates/)
- Meta's "Estimated and In-Development Insights Metrics" page reportedly lists `quality_ranking` in that category. That page now returns 404, so this is known only from a search snippet. — [search result: developers.secure.facebook.com/docs/marketing-api/insights/estimated-in-development](https://developers.secure.facebook.com/docs/marketing-api/insights/estimated-in-development)

**Ranking definitions and threshold (third-party)**
- Quality ranking compares perceived quality with competing ads. Engagement rate ranking compares expected engagement. Conversion rate ranking compares expected conversion rate against ads with the same optimization goal.
- Rankings appear only after an ad gets at least 500 impressions. They are shown as Above average / Average / Below average.
- Sources: [SaveMyLeads (third party)](https://savemyleads.com/blog/other/meta-ads-quality-ranking); [PPC Land (third party)](https://ppc.land/facebook-replaces-relevance-score-with-a-new-ad-relevance-diagnostics/)
- Meta's own Help Center article on ad relevance diagnostics could not be read (empty page body). — [Meta Business Help Center 403110480493160](https://www.facebook.com/business/help/403110480493160)

### Inferences
- For a click-to-WhatsApp ad, the destination (WhatsApp) is a Meta-owned property. `inline_link_clicks` ("on or off Facebook-owned properties") should therefore count taps on the WhatsApp CTA. `outbound_clicks` ("off Facebook-owned properties") is likely 0 or absent. Verify on real data; this is not documented specifically for CTWA.
- Prefer `cost_per_inline_link_click` over `cpc` for "cost per link click". `cpc` is cost per click (all), which includes reactions, comments, profile clicks and so on.
- Request ranking fields at `level=ad`; they are ad diagnostics. Store them as free strings. Expect a placeholder or unknown value when an ad has fewer than about 500 impressions.
- `unique_*` fields are estimated and "time consuming to compute". Request them in a separate call (see Section 9).

### Gaps
- The official full AdsInsights field reference page, and the exact value enum and minimum-impression rule for the three ranking fields, could not be retrieved. Old URLs return 404, and the Help Center page body was empty. Do not hardcode ranking values.
- No official definition was found for `unique_clicks` / `unique_inline_link_clicks` beyond the SDK names and the "estimated" note on their cost counterparts.
- `cost_per_result` / `cost_per_objective_result` exist in the SDK, but their definitions were not verified.

## 3. `link_click` vs `inline_link_clicks`, and which action types appear for click-to-WhatsApp

### Takeaway
`actions[link_click]` has the same definition as `inline_link_clicks`, but follows the query's attribution windows. `inline_link_clicks` is fixed at 1d_click. The two can therefore differ slightly.

Action types officially documented in Meta's AdsActionStats reference:
- `onsite_conversion.messaging_conversation_started_7d` ("Messaging Conversations Started")
- `onsite_conversion.messaging_first_reply` ("New Messaging Conversations")
- `onsite_conversion.messaging_block` ("Blocked Messaging Conversations")
- `onsite_conversion.messaging_user_subscribed`
- `link_click`, `post_engagement`, `page_engagement`, `post_reaction`, `comment`, `onsite_conversion.post_save`, `video_view`

Not on Meta's official list, but seen in third-party connector references:
- `onsite_conversion.total_messaging_connection`
- `onsite_conversion.messaging_conversation_replied_7d`
- `onsite_conversion.messaging_user_depth_2_message_send` / `_3_`

### Cited Findings
**Official AdsActionStats reference (exact labels)** — [Ads Action Stats reference](https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/)
- Messaging:
  - `onsite_conversion.messaging_block`: "Blocked Messaging Conversations"
  - `onsite_conversion.messaging_conversation_started_7d`: "Messaging Conversations Started"
  - `onsite_conversion.messaging_first_reply`: "New Messaging Conversations"
  - `onsite_conversion.messaging_user_subscribed`: "Messaging Subscriptions"
- Clicks, engagement and grouped types:
  - `onsite_conversion.post_save`: "Post Saves"
  - `link_click`: "Link Clicks"; `outbound_click`: "Outbound Clicks"
  - `post_reaction`, `comment`, `post` (shares), `like` (Page likes), `photo_view`, `video_view` ("3-Second Video Views")
  - `page_engagement`, `post_engagement`
  - `onsite_conversion.lead_grouped`, `lead`
- `onsite_conversion.total_messaging_connection` is **not** on this page.
- AdsActionStats object fields:
  - Attribution windows: `1d_click`, `7d_click`, `28d_click`, `1d_view`, `7d_view`, `28d_view`, `1d_ev` ("1 day after having an engaged view"), `dda`, `incrementality`, `inline`
  - `value` ("Metric value of default attribution window")
  - `action_carousel_card_id`, `action_carousel_card_name`

**Link clicks vs inline link clicks**
- `actions:link_click` "respects the attribution window `action_attribution_windows` setting in your query". Inline link clicks use a fixed `1d_click` window. — [Meta Ads Developer Blog 2016](https://developers.facebook.com/ads/blog/post/2016/03/16/link-clicks-updates/)
  - The 2016 post states the default then was 28d_click/1d_view. The current reference says `default` means `["7d_click","1d_view"]`. — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)

**Third-party connector references for extra messaging action types**
- Windsor.ai:
  - `actions_onsite_conversion_total_messaging_connection` is named "New Messaging Connections": "new messaging conversations started with your business by people who had not messaged you before, attributed to your ads".
  - `messaging_conversation_started_7d` is described as "a messaging conversation was started with your business after at least seven days of inactivity".
  - `messaging_block`: "times that people blocked a messaging connection with your business, attributed to your ads".
  - Windsor's own labels are internally inconsistent: its cost-per field for `conversation_started_7d` is labelled "Cost per New Messaging Connections".
  - Source: [Windsor.ai Facebook fields](https://windsor.ai/data-field/facebook/)
- Adverity:
  - Lists `messaging_conversation_replied_7d` (conversations where a reply occurred within 7 days, attributed to an ad) with `.1d_click/.7d_click/.28d_click` variants.
  - Lists `messaging_user_depth_2_message_send` (incremental-variant description: users sending a second message).
  - Source: [Adverity Facebook Ads connector](https://docs.adverity.com/reference/connectors/connector-facebook-ads.html)
- Dataddo lists `onsite_conversion.messaging_conversation_started_7d` ("messaging conversation start") and `onsite_conversion.messaging_first_reply` ("messaging conversation new"). — [Dataddo Facebook Ads fields](https://docs.dataddo.com/docs/facebook-ads-fields-references)
- Meta Help Center "About insights for the Messages objective" (per search snippet; the page body could not be fetched):
  - Messaging conversations started = the number of times people started messaging the business after at least 7 days of inactivity.
  - Some messaging metrics are unavailable for ads delivered to and from Europe and Japan.
  - Source: [Meta Business Help Centre 200322347047101](https://en-gb.facebook.com/business/help/200322347047101)

**Funnel context (vendor sources)**
- Link clicks and conversations started are different funnel steps. Example: 500 ad clicks vs 320 chats. — [DoubleTick (vendor)](https://learn.doubletick.io/why-do-i-see-a-difference-between-meta-ad-clicks-and-chats-initiated-on-doubletick)

### Inferences
- For CTWA reporting, the tool should parse **every** `action_type` that starts with `onsite_conversion.messaging_` (plus `onsite_conversion.total_messaging_connection`) generically. Store unknown types instead of whitelisting two. Which types appear depends on account, region and objective.
- Useful derived metrics:
  - Click-to-conversation rate = `messaging_conversation_started_7d` / `inline_link_clicks`.
  - New-contact share = `messaging_first_reply` (or `total_messaging_connection`) / `messaging_conversation_started_7d`.
  - Depth rate = `messaging_user_depth_2_message_send` / `conversation_started` (when present).
- `cost_per_action_type` returns the same action types with cost values. Read it rather than computing spend / count, so the attribution matches Meta.
- To mirror Ads Manager, do not pass `action_attribution_windows`; the default now follows ad-set settings. Pass explicit windows (e.g. `["1d_click","7d_click","1d_view"]`) only if per-window values are wanted.

### Gaps
- No official Meta definition was found for `onsite_conversion.total_messaging_connection`, `messaging_conversation_replied_7d`, or `messaging_user_depth_2/3/5_message_send`. They are confirmed only by third-party connector docs.
- Meta does not say whether these types appear for WhatsApp destinations specifically, as opposed to Messenger/Instagram Direct.
- I could not find an official statement that a CTWA CTA tap is counted in `inline_link_clicks` (Section 2 inference).

## 4. Carousel: per-card data via `action_breakdowns=action_carousel_card_id / action_carousel_card_name`

### Takeaway
Carousel card IDs and names are **action breakdowns**, so per-card values appear only inside action-type arrays. Officially, only `actions:link_click` and `unique_actions:link_click` are supported per card. Conversion metrics, which plausibly include messaging conversations, have not been supported per card since July 2018. No documentation says impressions or spend are split per card.

### Cited Findings
- The carousel breakdowns can be used alone, or combined with `impression_device`, `country`, `age`, `gender`, or `age, gender`. — [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns)
- Off-Meta restriction ("Type 2"), which covers `action_carousel_card_id/name`: off-Meta web metrics are returned without the breakdown value, and mobile app metrics are no longer returned. On-Meta metrics such as impressions and link clicks still work with breakdowns. — [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns)
- June 2018 non-versioned change, July 2018, all versions:
  - "We will no longer support `action_carousel_card_id` and `action_carousel_card_name` breakdowns for conversion metrics."
  - "You can still get `actions:link_click` and `unique_actions:link_click` metrics grouped by these carousel card breakdowns."
  - Source: [Graph API changelog, 18 Jun 2018](https://developers.facebook.com/docs/graph-api/changelog/non-versioned-changes/jun-18-2018)
- AdsActionStats fields:
  - `action_carousel_card_id`: "The ID of the specific carousel card that people engaged with when they saw your ad."
  - `action_carousel_card_name`: cards "are identified by their headlines".
  - Source: [Ads Action Stats reference](https://developers.facebook.com/docs/marketing-api/reference/ads-action-stats/)
- Funnel's connector says its carousel card breakdown supports only one metric, Link Clicks. This is from a search snippet; the page itself returned 404 on fetch. — [Funnel product update](https://funnel.io/product-updates/facebook-ads-carousel-card-breakdown)
- CData's "Action_Carousel_Card_Report" table exposes only ActionValue, InlineLinkClicks and an action collection (e.g. OutboundClicks). It has no impressions, reach or spend columns. — [CData JDBC Facebook Ads docs](https://cdn.cdata.com/help/HRM/jp/jdbc/pg_table-actioncarouselcardreport.htm)
- `action_breakdowns` requires the `actions` field to be requested. — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)
- v26.0: carousel ads support up to 10 cards. — [v26.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version26.0/)

### Inferences
- Plan per-card reporting as **link clicks per card**: entries in `actions` (and `cost_per_action_type`) where `action_type=link_click`, each carrying `action_carousel_card_id` / `action_carousel_card_name`.
- Top-level `impressions`, `spend` and `reach` in such a response are most likely ad-level totals, not per-card values. This is inferred from all sources being silent and from the breakdown being an action breakdown.
- Per-card WhatsApp conversations are likely **not** available. They are conversion metrics, and the 2018 rule excludes those.
- Because card names are the card headlines, cards with identical headlines will be indistinguishable by name. Key on the card ID.

### Gaps
- No current (2025-2026) Meta document explicitly lists which fields are returned per card, or confirms impressions are not per card.
- I could not verify whether `onsite_conversion.messaging_*` returns per-card values for a CTWA carousel. Test with one read-only call.

## 5. Breakdowns: available values and valid combinations (age, gender, device, placement, hourly, region)

### Takeaway
Only listed permutations are stored. For this tool, the useful valid combinations are:
- `age`; `gender`; `age,gender`; `country`; `region`
- `publisher_platform`, optionally with `platform_position` and/or `impression_device`
- each `hourly_stats_*` breakdown alone

`device_platform` is a valid breakdown name, but its combinations were not shown. `impression_device` cannot be used alone and needs account enablement from 6 Aug 2026.

Hourly breakdowns do not return reach, frequency, `unique_*` or video fields. Region and hourly breakdowns drop off-Meta action metrics.

### Cited Findings
All findings in this section come from [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns) unless another source is named.

**Generic breakdowns**
- `age`, `gender`, `country`, `region`, `dma` (retired, see Section 1), `device_platform`, `impression_device`, `publisher_platform`, `platform_position`, `frequency_value`, `hourly_stats_aggregated_by_advertiser_time_zone`, `hourly_stats_aggregated_by_audience_time_zone`
- Dynamic-creative asset breakdowns: `body_asset`, `image_asset`, `title_asset`, etc. These are limited to impressions, clicks, spend, reach, actions and action_values.

**Stored combinations**
- Combinations marked * can also be joined with `action_type`, `action_target_id` and `action_destination`.
- Demographic and geography:
  - `age`*, `gender`*, `age, gender`*
  - `country`*, `region`*
- Placement:
  - `publisher_platform`*
  - `publisher_platform, impression_device`*
  - `publisher_platform, platform_position`*
  - `publisher_platform, platform_position, impression_device`*
- Time:
  - `hourly_stats_aggregated_by_advertiser_time_zone`*
  - `hourly_stats_aggregated_by_audience_time_zone`*
- Action device:
  - `action_device` (with `impression_device` / `publisher_platform` / `platform_position`)
- Carousel: as listed in Section 4.

**Hourly restrictions**
- "Hourly breakdowns do not support unique fields": `reach` and `frequency` return 0, and `unique_*` is not supported.
- `video_*` fields cannot be requested with hourly breakdowns.
- Data is available for the last 13 months only.

**Off-Meta restrictions**
- Type 1: `region`, `dma` and both `hourly_stats_*` no longer return off-Meta action metrics.
- Type 2: `action_device`, `action_destination`, `action_target_id`, `product_id`, carousel and canvas breakdowns return web metrics without the breakdown value, and mobile app metrics are dropped.
- On-Meta metrics are unaffected.

**Other restrictions**
- Fields that cannot be requested with any breakdown: `app_store_clicks`, `newsfeed_avg_position`, `newsfeed_clicks`, `relevance_score`, `newsfeed_impressions`.
- `frequency_value` works with `reach` only. It needs enablement from 6 Aug 2026 and is limited to 6 months of history. — [OCC 2025](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025.md); [OCC 2026](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2026.md)
- Breakdown values are estimated.
- Action metrics are unavailable when aggregating across multiple attribution settings. Requesting `action_attribution_windows=1d_click,7d_click,1d_view,incrementality` restores them.
- `impression_device` "cannot be used alone". — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)

**Time parameters** — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)
- `time_increment` accepts `monthly`, `all_days` (default), or an integer from 1 to 90.
- `time_ranges` overrides `date_preset`, `time_range` and `time_increment`, and does not allow a granular `time_increment`.

### Inferences
- For "device", use `breakdowns=device_platform` (values like mobile_app / mobile_web / desktop). A phone-model style split needs `publisher_platform,impression_device`, which may return empty unless the account has enabled `impression_device`. Handle empty results gracefully.
- `gender` and `age,gender` are documented and safe. The tool already does `age`; `age,gender` would replace both.
- For hourly, request only non-unique metrics (`spend`, `impressions`, `clicks`, `inline_link_clicks`, `actions`).
  - Onsite messaging actions are on-Meta, so they should still be returned with hourly breakdowns, though this is not explicitly confirmed.
  - Hourly buckets follow the ad account's time zone (`..._advertiser_time_zone`).
- No document found prohibits combining a regular (non-hourly) breakdown with `time_increment=1`. It is used widely, but each extra dimension multiplies rows. Keep the date range short.

### Gaps
- The fetched Breakdowns page did not show the stored combinations for `device_platform`, whether it can pair with `age`/`gender`, or whether `time_increment` has any breakdown-specific restriction. Verify with a single test call.
- Whether onsite messaging conversions are returned with `region` or hourly breakdowns is not stated explicitly.

## 6. Reach and frequency: deduplication, daily reach, breakdowns, cumulative reach

### Takeaway
`reach` is a deduplicated, estimated count of accounts for each returned row (per object and per time bucket). Daily reach rows (`time_increment=1`) are valid but **must not be summed**.

For cumulative reach of an ad set or campaign, either query the whole period in one row (`time_increment=all_days`, the default), or use overlapping `time_ranges` from the start date to each day. Meta documents that overlapping ranges are allowed "to return cumulative insights".

Limits:
- Reach is not returned for breakdown queries starting more than 13 months ago (async can recover it, up to 10 requests per ad account per day).
- Reach and frequency return 0 with hourly breakdowns.

### Cited Findings
- `reach`: "The number of Accounts Center accounts that saw your ads at least once", estimated. `frequency`: average times each person saw the ad, estimated. — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)
- `time_ranges`: "Time ranges can overlap, for example to return cumulative insights." Each range returns its own result set. — [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/)
- From 10 Jun 2025, reach "will no longer be returned for standard queries that apply `breakdowns`" with a `start_date` more than 13 months old.
  - Workaround: async jobs, "up to 10 requests per Ad Account per day".
  - Monitor the `x-Fb-Ads-Insights-Reach-Throttle` header; once its limit is breached, requests omit reach.
  - Sources: [Insights Limits & Best Practices](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices.md); [OCC 2025](https://developers.facebook.com/documentation/ads-commerce/marketing-api/out-of-cycle-changes/occ-2025.md)
- With hourly breakdowns, `reach` and `frequency` return 0. — [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns)
- DMA used sampling for unique metrics. The page advises querying impressions as well. — [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns)
- "Unique metrics are time consuming to compute"; query them in a separate call. — [Insights Limits & Best Practices](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices.md)
- Insights refresh every 15 minutes and stop changing 28 days after being reported. Metrics can keep updating for a couple of days after an ad ends. — [Insights Limits & Best Practices](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices.md)
- Third-party guidance:
  - Summing daily reach, or reach across ads, ad sets or campaigns, double-counts people.
  - Account- or campaign-level reach is usually lower than the sum of its children.
  - Sources: [Supermetrics: About reach](https://docs.supermetrics.com/docs/about-reach); [Jon Loomer (third party)](https://www.jonloomer.com/?p=26952)

### Inferences
- The existing tool's daily request (`fields=spend,actions, time_increment=1`) never asks for `impressions`, `reach` or `clicks`. The API simply does not return them, and the tool fills 0. The fix is to add those fields to the daily call; no special permission or endpoint is needed.
- Daily `reach` = unique accounts reached that day. Daily `frequency` = impressions / reach for that day. Present daily reach as "reached today", never as a running total.
- For a cumulative ad-set reach curve, one GET with `level=adset` and `time_ranges` of the form `[{since: launch, until: d1}, {since: launch, until: d2}, ...]` returns one deduplicated row per range. The day-over-day difference is approximately "new people reached".
- `level=adset` totals give reach deduplicated across the ads inside each ad set. `level=campaign` gives reach deduplicated across ad sets. Summing adset rows will overstate campaign reach.

### Gaps
- No Meta page found that states the deduplication rule explicitly per level (campaign vs ad set vs ad). It follows from the definition (unique accounts per row) and third-party guidance.
- No documented maximum number of `time_ranges` entries per request was found. Keep it modest (e.g. at most about 30 ranges).

## 7. Read-only ways to get audience size, and required permissions

### Takeaway
Three read-only sources:
- Custom audiences: `approximate_count_lower_bound` / `approximate_count_upper_bound` on the CustomAudience object.
- Ad account reach estimate: `GET /act_<ID>/reachestimate` with a `targeting_spec`, returning `users_lower_bound` / `users_upper_bound`.
- Ad set delivery estimate: `GET /{adset_id}/delivery_estimate`. From 27 Oct 2026 it no longer returns `estimate_dau`, `daily_outcomes_curve` or `budget_guardrail`.

`ads_read` officially covers pulling Ads Insights report data. The docs do not state whether `ads_read` alone suffices for these three endpoints.

### Cited Findings
- CustomAudience: `approximate_count_lower_bound` = "Lower bound of the approximate number of people in this audience"; `approximate_count_upper_bound` = the upper bound. Both return `-1` for inactive lookalikes. — [Custom Audience reference](https://developers.facebook.com/docs/marketing-api/reference/custom-audience/)
  - `delivery_status` code `200` = active and ready. `300` = audience smaller than it should be, "currently inactive and cannot be used".
  - Error `270` concerns apps with development access. The token user must be admin of the app (and of the ad account).
- `GET /act_<AD_ACCOUNT_ID>/reachestimate`: read only ("You can't perform this operation on this endpoint" for create/update/delete).
  - `targeting_spec` is required, and `countries` is required within it.
  - Returns a range in `users_lower_bound` and `users_upper_bound`.
  - For custom audiences, estimates may be unavailable, in which case it returns `-1`.
  - Sources: [Ad Account reachestimate reference](https://developers.facebook.com/docs/marketing-api/reference/ad-account/reachestimate/); [Reach Estimate guide (v26.0)](https://developers.facebook.com/documentation/ads-commerce/marketing-api/audiences/guides/reach-estimate.md)
- `GET /{ad-set-id}/delivery_estimate`: "Returns the delivery estimate for a given ad set."
  - Parameters are optional and default to the ad set's current settings.
  - It cannot be retrieved for inactive Lookalike Audiences.
  - Error 80004 = rate limit; 200 = permissions error.
  - Source: [Ad Set delivery_estimate reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign/delivery_estimate/)
- `daily_outcomes_curve`, `budget_guardrail` and `estimate_dau` are removed from Delivery Estimate responses on all versions on 27 Oct 2026, with no replacement. — [v26.0 changelog](https://developers.facebook.com/docs/graph-api/changelog/version26.0/)
- Permissions:
  - `ads_read` lets an app use the Ads Insights API to "pull Ads report information for Ad accounts you own".
  - `ads_management` "allows your app to both read and manage the Ads account it owns".
  - Source: [Permissions reference](https://developers.facebook.com/docs/permissions/)
- The Insights API prerequisite is "an app and the `ads_read` permission". — [Insights API overview](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights.md)

### Inferences
- If the tool's token already has `ads_management` (the upload tool needs it), these GET endpoints will work. Whether an `ads_read`-only token is enough for `reachestimate`, `delivery_estimate` or reading custom audiences is undocumented. Test with one GET.
- After 27 Oct 2026, a delivery_estimate call is useful mainly for `estimate_mau_lower_bound` / `estimate_mau_upper_bound` (audience size) and `estimate_ready`. Do not build on `estimate_dau` or the outcomes curve.
- Audience-size numbers are ranges and estimates. Show them as "about X-Y people", not as exact values.

### Gaps
- The `delivery_estimate` response field list (`estimate_mau_lower_bound`, `estimate_mau_upper_bound`, `estimate_ready`) was not shown on the fetched page. These names are from prior knowledge, not verified in this session.
- No official statement on the exact permission each endpoint needs.

## 8. Rate limits and good practice for adding about 3-6 more requests

### Takeaway
Adding 3-6 GET insights calls per run is far below every documented limit, even on the Development tier:
- API-level score: max 60 points per 300 s decay, with each read = 1 point.
- `ads_insights` business-use-case quota per ad account per hour: 600 + 400 × active ads.

Good practice:
- Combine fields into one request per level/breakdown.
- Put `unique_*` fields in a separate call.
- Prefer `date_preset` over custom ranges.
- Optionally wrap the GETs in a single batch request.
- Read the throttle headers and back off on errors 4, 17 or 80000.

### Cited Findings
All findings in this section come from [Marketing API Rate Limiting](https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/rate-limiting.md) unless another source is named.

**Quotas and scoring**
- `ads_insights` quota per ad account, per one-hour window: 190000 (full access) or 600 (dev tier), + 400 × number of active ads − 0.001 × user errors. When throttled, all of the app's Insights calls are limited.
- API-level score: a read call = 1 point, a write = 3.
  - Development tier: max 60, decay 300 s, blocked 300 s at the max.
  - Full access: max 9000, decay 300 s, block 60 s.
- Full access needs "500+ Marketing API calls in the past 15 days" and an error rate below 15%.

**Error codes**
- `17` (subcode 2446079): user request limit.
- `4` (subcodes 1504022 / 1504039): Insights platform limit. Code 4 with no subcode is the app-level limit.
- `80000` / `80003` / `80004` / `80014`: ad-account BUC limit.
- `613`: depends on subcode.

**Headers**
- `X-Business-Use-Case` (as named in the doc): `call_count`, `total_cputime`, `total_time`, `estimated_time_to_regain_access`
- `X-FB-Ads-Insights-Throttle`: `app_id_util_pct`, `acc_id_util_pct`, `ads_api_access_tier`
- `X-Ad-Account-Usage`

**Best practices** — [Insights Limits & Best Practices](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights/best-practices.md)
- Data too large returns `error_code = 100`, subcode 1487534. Narrow the date range, the number of ad IDs, or the metrics.
- Use batch requests for multiple sync calls. Use async for large volumes.
- Query unique metrics separately.
- "Use `date_preset` if possible. Custom date ranges are less efficient".
- Spread `/insights` calls over time, and back off near 100% utilization.
- Async jobs: `report_run_id` expires after 30 days; a job can take up to an hour.
- Recommended order: "Try sync calls first and then use async calls in cases where sync calls timeout".

### Inferences
- For a single small campaign, sync GETs are appropriate. Async report runs are needed only for reach-with-breakdowns older than 13 months, or for `impression_device` / `frequency_value` history after enablement.
- Async (`POST /{object}/insights`) and batch (`POST /` with GET sub-requests) are HTTP POSTs, although they only create a report job or wrap reads; they change no ads. If the project's safety policy treats any POST to Meta as a "write", stay with plain GETs, which is entirely sufficient here.
- Log `X-FB-Ads-Insights-Throttle` and `X-Business-Use-Case` on each response, and stop the run if a percentage exceeds about 75%.

### Gaps
- No public per-request limit on number of fields or on number of `time_ranges` was found.

## 9. Example GET requests (read-only) for the planned extensions

### Takeaway
All examples are plain GETs on `/{campaign_id}/insights`, using `level` to roll down to ad set or ad. Version shown: v26.0; v25.0 is equivalent. JSON parameters must be URL-encoded. Each example is grounded in the parameters, fields and breakdowns cited in Sections 2-6. Combinations marked "test" are undocumented.

### Cited Findings
- Parameter semantics are documented in the [Campaign Insights reference](https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group/insights/):
  - `level` (ad / adset / campaign / account)
  - `time_increment` (1-90, monthly, all_days)
  - `time_range` `{since, until}` (YYYY-MM-DD)
  - `time_ranges` (overlapping allowed, for cumulative insights)
  - `date_preset` (e.g. `maximum`, `last_7d`, `yesterday`)
  - `filtering`, `summary` / `default_summary`
  - `action_breakdowns` (requires `actions`)
- Breakdown names and combinations: [Insights Breakdowns](https://developers.facebook.com/docs/marketing-api/insights/breakdowns). Field names: [SDK adsinsights.py](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py).

### Inferences
The example requests follow; they are inferred from the docs above. Placeholders: `{CID}` = campaign ID, `{ASID}` = ad set ID, `{ACT}` = ad account ID.

**A. Daily trend at campaign level (fixes the "0 impressions/reach/clicks per day" issue)**
```
GET /v26.0/{CID}/insights
  ?level=campaign
  &time_increment=1
  &date_preset=maximum            (or time_range={"since":"2026-10-21","until":"2026-10-26"})
  &fields=date_start,date_stop,spend,impressions,reach,frequency,clicks,
          inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,
          cpm,actions,cost_per_action_type
```
Read from `actions` / `cost_per_action_type`: `onsite_conversion.messaging_conversation_started_7d`, `onsite_conversion.messaging_first_reply`, `link_click`, plus any other `onsite_conversion.messaging_*`. Daily `reach` is per-day unique and must not be summed.

**A2. Cumulative reach curve (deduplicated running total)**
```
GET /v26.0/{CID}/insights
  ?level=campaign            (or level=adset for per-ad-set curves)
  &time_ranges=[{"since":"2026-10-21","until":"2026-10-21"},
                {"since":"2026-10-21","until":"2026-10-22"},
                {"since":"2026-10-21","until":"2026-10-23"}, ...]
  &fields=reach,impressions,frequency,spend
```
Do not combine with a numeric `time_increment`.

**B. Ad-set totals with reach, frequency and CPM**
```
GET /v26.0/{CID}/insights
  ?level=adset
  &date_preset=maximum
  &fields=adset_id,adset_name,spend,impressions,reach,frequency,cpm,cpp,
          clicks,inline_link_clicks,cost_per_inline_link_click,actions,cost_per_action_type
```

**C. Ad level: link clicks, CPC and quality rankings**
```
GET /v26.0/{CID}/insights
  ?level=ad
  &date_preset=maximum
  &fields=ad_id,ad_name,adset_id,spend,impressions,reach,frequency,cpm,
          clicks,cpc,ctr,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click,
          outbound_clicks,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,
          actions,cost_per_action_type
```
Notes:
- Rankings are meaningful only after about 500 impressions (third-party); store them as strings.
- `outbound_clicks` is expected to be empty for CTWA (inference).
- Optional separate call for unique metrics: `fields=ad_id,unique_clicks,unique_inline_link_clicks,unique_ctr,cost_per_unique_inline_link_click`.

**D. Carousel card breakdown (link clicks per card)**
```
GET /v26.0/{CID}/insights
  ?level=ad
  &date_preset=maximum
  &action_breakdowns=action_carousel_card_id,action_carousel_card_name
  &fields=ad_id,ad_name,impressions,spend,actions,cost_per_action_type
```
Notes:
- Per-card values come back as `actions[]` elements carrying `action_carousel_card_id` / `action_carousel_card_name`. Read `action_type=link_click`.
- Expect no per-card messaging conversions (2018 conversion-metric restriction).
- Top-level `impressions` / `spend` are ad totals.
- Test: if the two-key action breakdown errors, use `action_breakdowns=action_carousel_card_id` alone.

**E. Device and gender breakdowns**
```
GET /v26.0/{CID}/insights?level=campaign&date_preset=maximum
  &breakdowns=device_platform
  &fields=spend,impressions,reach,inline_link_clicks,actions

GET /v26.0/{CID}/insights?level=campaign&date_preset=maximum
  &breakdowns=age,gender            (or breakdowns=gender)
  &fields=spend,impressions,reach,inline_link_clicks,actions,cost_per_action_type

GET /v26.0/{CID}/insights?level=campaign&date_preset=maximum
  &breakdowns=publisher_platform,impression_device
  &fields=spend,impressions,inline_link_clicks,actions
```
The last request may return empty unless `impression_device` is enabled for the ad account (from 6 Aug 2026). Treat an empty result as "not enabled", not as "no data". Enabling it needs a POST to `/act_{ACT}/insights/feature-settings` or an admin in Ads Manager; leave that to the user.

**F. Hourly (advertiser time zone)**
```
GET /v26.0/{CID}/insights
  ?level=campaign
  &time_range={"since":"2026-10-25","until":"2026-10-25"}   (or date_preset=last_7d)
  &breakdowns=hourly_stats_aggregated_by_advertiser_time_zone
  &fields=spend,impressions,clicks,inline_link_clicks,actions
```
Do not request `reach`, `frequency`, `unique_*` or `video_*`; reach and frequency come back as 0. Data covers the last 13 months only. Combining hourly with `time_increment=1` over several days gives day × hour rows. This is undocumented; test it.

**G. (Optional) one round trip for several of the above: Graph batch**

A POST to `https://graph.facebook.com/` with `batch=[{"method":"GET","relative_url":"v26.0/{CID}/insights?level=adset&..."}, ...]`. This is read-only in effect, but it is an HTTP POST; see the Section 8 inference.

### Gaps
- The following combinations were not verified against the live API, and each should be confirmed with one test call:
  - `action_breakdowns` with two carousel keys
  - `device_platform` together with other breakdowns
  - hourly together with `time_increment=1`
- `cost_per_action_type` per carousel card is not documented.
