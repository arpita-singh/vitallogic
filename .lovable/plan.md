
The user wants two changes:

1. **Remove "Amazon of health" wording** — find any usage in the codebase (likely in copy somewhere) and replace with "your natural health hub".
2. **Convert the uploaded lotus logo image to SVG** and use it as the Vital Logic brand logo across the site (currently the logo is a `Sparkles` icon inside a gradient circle in `site-header.tsx` and `site-footer.tsx`).

Let me explore to confirm scope before planning.
<lov-tool-use id="toolu_vrtx_01AY58rnvFXpq4NoAFCiRmuy" name="code--search_files" integration-id="code" data="{\"query\": \"Amazon\", \"include_patterns\": \"*.tsx,*.ts,*.md,*.css\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015MPXgdpeU2qWYar5NXFZ2y" name="code--search_files" integration-id="code" data="{\"query\": \"Sparkles\", \"include_patterns\": \"*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_016vtxj2nUq9eYpEvBTkGoNy" name="code--search_files" integration-id="code" data="{\"query\": \"Amazon\", \"include_patterns\": \"*.tsx,*.ts,*.md\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_014yZ4WTaLe1uP3kcLkmq9Lr" name="code--search_files" integration-id="code" data="{\"query\": \"amazon of health\", \"case_sensitive\": false}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Lof2urC7GmQMCMVwwdQiCL" name="code--search_files" integration-id="code" data="{\"query\": \"Sparkles\", \"include_patterns\": \"*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XQCzVq9b7vcwJeFR414t99" name="code--view" integration-id="code" data="{\"file_path\": \"src/routes/index.tsx\", \"lines\": \"1-90\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017vTuyyCKWEXARbe3nBDvXS" name="code--view" integration-id="code" data="{\"file_path\": \"user-uploads://image-7.png\"}">
<lov-image url="https://storage.googleapis.com/gpt-engineer-file-uploads/3f58001e-f092-4c1a-8c5f-22db738b3ff3-user-uploads://image-7.png?Expires=1776593142&GoogleAccessId=go-api-on-aws%40gpt-engineer-390607.iam.gserviceaccount.com&Signature=YUigNsWcPfFvmezarx4BeLVbJSJgV95o7iirpAIGjUDBabU15DFdP4sCa4dseR%2BLoBQRy9WTE5EeWmoFa2o5ZSMTAVLxGHiahEovc0J7qL%2FilMI0KhJHM6y4ZvaurRM4DrFKB8k1MUd4LiD87nJ5ziMCqPs6g%2BgeBa%2F58ti0O5uKY1d4yJgCHJyUaX8NvVh46VMQxH6pcBBh%2FZZrPFDAnEiqKl%2F4dD%2FZWqIHL69CS6xzAq8ot1BUMsjcDSZT2az4HIIhqDgeqFcw1%2BnnDeVxP0EUowVphA07U4djnzjdrw0LWZG7u%2FqjGhHC1SIgSIChuKBMetLaX3%2Br%2FepkyoyIHA%3D%3D" mimeType="image/png"/></lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Wq4CT7vea6KzsYwLk2b8PY" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/assets\"}">
</lov-tool-use>
I have what I need. Let me present a focused plan.

<lov-plan>

## Plan

Two changes — copy update + new SVG logo.

### 1. Replace "The Amazon of Health" tagline

Update `src/routes/index.tsx`:
- Hero `<h1>` (lines 51-55): change "The Amazon / of Health" → "Your Natural / Health Hub" (keeping the gold gradient on "Natural").
- `head()` meta titles/descriptions (lines 9, 15): swap to "Vital Logic — Your Natural Health Hub".

Update `src/routes/__root.tsx` meta tags (lines 45, 54, 55): same swap.

No other files reference "Amazon".

### 2. Create a custom SVG lotus logo

Create `src/assets/vital-logic-logo.svg` — a hand-built, scalable SVG inspired by the uploaded reference:
- **Center**: a luminous gold sphere (radial gradient, gold core → warm amber edge).
- **Lotus petals**: ~9 stylized petals arranged symmetrically (4 per side + 1 top center), drawn as SVG paths with violet stroke and a translucent violet fill.
- **Circuit-board accents**: thin polylines and small dots traced along each petal (the "tech-meets-nature" motif).
- **Glow**: SVG `<filter>` with `feGaussianBlur` for the violet outer glow + gold inner glow.
- **Color tokens** (matched to existing palette): violet `#8B5CF6`, gold `#F4C151`, deep background-friendly (transparent bg so it works on dark surfaces).
- Designed at `viewBox="0 0 200 160"` so it scales cleanly down to a 32×32 header mark.

I will NOT bake in the "VITAL LOGIC / HEALTH MARKETPLACE" wordmark — the wordmark already exists as text next to the logo in the header/footer. The SVG is the symbol only.

### 3. Wire the SVG into the brand

Replace the `Sparkles`-in-gradient-circle placeholder in:
- `src/components/site-header.tsx` (lines 60-63)
- `src/components/site-footer.tsx` (lines 10-14)

Import via `import logo from "@/assets/vital-logic-logo.svg"` and render as `<img src={logo} alt="Vital Logic" className="h-8 w-8" />`. Drop the now-unused `Sparkles` import from these two files.

The hero already uses `heroLotus` (the existing photographic asset) — I'll leave that untouched. The new SVG is purely the brand mark.

### Constraints
- No backend/DB/auth changes.
- No new dependencies (raw SVG, no icon libs).
- Don't touch the hero image or any other route.

