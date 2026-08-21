import { describe, it, expect } from 'vitest';
import { isSocialRecipeUrl, parseOgTags } from './social-import';

describe('isSocialRecipeUrl', () => {
  it('matches the three platforms, any subdomain, and youtu.be', () => {
    for (const url of [
      'https://www.tiktok.com/@cook/video/123',
      'https://vm.tiktok.com/ZS8abc/',
      'https://www.instagram.com/reel/Cxyz/',
      'https://youtube.com/watch?v=abc',
      'https://m.youtube.com/watch?v=abc',
      'https://youtu.be/abc',
    ]) expect(isSocialRecipeUrl(url)).toBe(true);
  });

  it('rejects ordinary recipe sites and garbage', () => {
    expect(isSocialRecipeUrl('https://www.recipetineats.com/butter-chicken/')).toBe(false);
    expect(isSocialRecipeUrl('https://nottiktok.com/x')).toBe(false);
    expect(isSocialRecipeUrl('not a url')).toBe(false);
  });
});

describe('parseOgTags', () => {
  it('reads property/name metas in either attribute order, entities decoded', () => {
    const html = `<html><head>
      <meta property="og:title" content="One-pan chicken &amp; rice" />
      <meta content="Serves 4 &#39;easy&#39;" property="og:description">
      <meta name="og:image" content="https://cdn.example/img.jpg">
    </head></html>`;
    const tags = parseOgTags(html);
    expect(tags['og:title']).toBe('One-pan chicken & rice');
    expect(tags['og:description']).toBe("Serves 4 'easy'");
    expect(tags['og:image']).toBe('https://cdn.example/img.jpg');
  });

  it('first occurrence wins; empty content preserved', () => {
    const html = `<meta property="og:title" content="A"><meta property="og:title" content="B"><meta property="og:video" content="">`;
    const tags = parseOgTags(html);
    expect(tags['og:title']).toBe('A');
    expect(tags['og:video']).toBe('');
  });
});
