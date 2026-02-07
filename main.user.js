// ==UserScript==
// @name         4get-newsit
// @namespace    https://github.com/kewwwal/
// @version      1.1
// @description  newsit integration for lolcat's 4get search engine
// @author       kewwwal
// @match        *://*/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAD1BMVEWrqKNNYGcMDAwSBQAAAAC5zpuWAAAAfUlEQVQ4jc2SSRKAIAwEmcD/36xIFklY9GCVc6SbCVCk9JMQrWnN3mAFQBTyFeFROGEpORNzNbR1LJBN5hEkHI23RROsoBqVSy233TjaJhMkTtCrBY5u7oDrKbsHBpyRaM7jY8JnK3hlKwycpRCgd5bCDD4Shh/ynZB2/Jsc3rUCCRq/qkkAAAAASUVORK5CYII=
// @homepageURL  https://github.com/kewwwal/4get-newsit
// @supportURL   https://github.com/kewwwal/4get-newsit/issues
// @updateURL    https://raw.githubusercontent.com/kewwwal/4get-newsit/main/main.user.js
// @downloadURL  https://raw.githubusercontent.com/kewwwal/4get-newsit/main/main.user.js
// @license      MIT
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @grant        GM_listValues
// @connect      reddit.com
// @connect      old.reddit.com
// @connect      www.reddit.com
// @connect      hn.algolia.com
// @connect      algolia.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.8/purify.min.js
// ==/UserScript==

(function() {
    'use strict';

    const cfg = {
        apiTimeout: 10000,
        cacheTtl: 6 * 60 * 60 * 1000,
        cachePrefix: { rd: 'rd_', hn: 'hn_' },
        debounce: 500,
        icons: {
            rd: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAilBMVEVHcEz/RQD/RgD/RQD/RQD/RQD/RAD/RQD/RQD/RQD/RgD/RQD+////PwD/OADr9Pbi6+73/f3K2+P7flzT4ugAAAL5ZTr2+Pj0uKzGy83+ThP70cb7kXjc19frnY/+6+XajYHxck/Ro6M8LSr/WAAFFxz/bkioNhLTQCNkZWaCUELvGwDeWT6IfHsSwPnoAAAAC3RSTlMAyU9RouIMIvWPUzQQe5EAAAGkSURBVDiNhVPpeqwgDNWpjk5jWARxt9rZu7z/6zVAnWpv/e75g3JOCEkOQfDA/jkKU4A0PDztg3+RREQ+ECW/+QP8wmEdHq9IZAwhXhySpCuedW1rENJkg8cuIzTwo1ifD9e7IMHAAOK/7nc7Hz9FJuWA802Tdfz5ikoL0aP7s0miVf7rEQHNMDZeEFH/PIGuuEa9vamGUZWIXrEPnmxdjVLALtVL5vBSXRgoEhK1sxlYV9Jumy3QkrbsmL1mCKiyDSiEMEiBtVuClkEawEPw+joT8xcJwAoqXsosG9/N4PeH92mkpeSVFaRUtuZSljcwxgsMmFuZSa7txOiSgJMopfw4nS5eMJ1OHxQhJmpF6BrpkvRKzX1Qqpc+AZX57AbMOUmk6GtCL6SUtNGha5RvdS8EbR0LhyN9ctF/t9rloAHSBHldFOdzUdRcCK0V+mH5cbMxz3Mt6ntR3Gti83xk87i9YdhU504jtF1rxRbWdpbDZui1I3PdD94O8dq0DExXEToDLnxh69mVSJ6xZoENfo34P/zP09v9RUfb784+/93i+X8BtrYxyahtbccAAAAASUVORK5CYII=',
            hn: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAAPFBMVEX/ZgD/////+fX/vZL/7OD/bAv/9O3/jUL/v5X/p23/nFr/2L7/cBL/6dr/iDn/sHz/mFT/1Lf/3sn/oGHk31anAAAAQklEQVQYlWNgoDJgZWMBkuyMHEhinIxcDAzcTDzI6lh4GfgY+VG0CjAKCLKxohonxMIojGYDHyMvhq1MzNQTogIAANoJARPbxOAzAAAAAElFTkSuQmCC'
        },
        maxActive: 3,
        requestGap: 200,
        queueTimeout: 5000
    };

    const limit = {
        active: 0,
        queue: []
    };

    function gc() {
        const keys = GM_listValues();
        const now = Date.now();
        for (const k of keys) {
            if (k === 'oldReddit') continue;
            if (k.startsWith(cfg.cachePrefix.rd) || k.startsWith(cfg.cachePrefix.hn)) {
                try {
                    const raw = GM_getValue(k);
                    if (!raw) { GM_deleteValue(k); continue; }

                    const data = JSON.parse(raw);
                    if (now - data.time > cfg.cacheTtl) GM_deleteValue(k);
                } catch { GM_deleteValue(k); }
            } else {
                GM_deleteValue(k);
            }
        }
    }

    async function waitLimit() {
        if (limit.active >= cfg.maxActive) {
            const slot = new Promise(r => limit.queue.push(r));
            const timer = new Promise(r => setTimeout(() => r(false), cfg.queueTimeout));
            if (!await Promise.race([slot, timer])) return false;
        }

        limit.active++;
        return true;
    }

    function freeLimit() {
        limit.active--;
        const next = limit.queue.shift();
        if (next) setTimeout(() => next(true), cfg.requestGap);
    }

    if (GM_getValue('oldReddit') === undefined) GM_setValue('oldReddit', true);
    const useOldReddit = GM_getValue('oldReddit', true);

    GM_registerMenuCommand(
        `Old Reddit: ${useOldReddit ? 'ON' : 'OFF'}`,
        () => { GM_setValue('oldReddit', !useOldReddit); location.reload(); }
    );

    function is4get() {
        return (document.querySelector('input[name="s"]') && document.querySelector('#overflow')) ||
               !!document.querySelector('.text-result');
    }

    if (!is4get()) return;

    function hashUrl(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    function readCache(prefix, url) {
        try {
            const key = prefix + hashUrl(url);
            const raw = GM_getValue(key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (Date.now() - data.time > cfg.cacheTtl) {
                GM_deleteValue(key);
                return null;
            }
            return data.value;
        } catch { return null; }
    }

    function writeCache(prefix, url, value) {
        try {
            GM_setValue(prefix + hashUrl(url), JSON.stringify({ time: Date.now(), value }));
        } catch (e) { console.error(e); }
    }

    function create(tag, cls, children = []) {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        if (Array.isArray(children)) children.forEach(c => c && el.appendChild(c));
        else if (typeof children === 'string') el.textContent = children;
        else if (children) el.appendChild(children);
        return el;
    }

    function cleanUrl(s) {
        try {
            const u = new URL(s);
            let h = u.host;
            if (h.startsWith('www.')) h = h.substring(4);
            else if (h.startsWith('m.')) h = h.substring(2);
            return h + u.pathname + u.search;
        } catch(e) { console.warn('Newsit: cleanUrl error', e); return s; }
    }

    function sameUrl(a, b) { return cleanUrl(a) === cleanUrl(b); }

    function parseReddit(html, targetUrl) {
        try {
            const clean = DOMPurify.sanitize(html.replace(/<img[^>]*>/g, ''));
            const box = document.createElement('div');
            box.innerHTML = clean;

            let best = null, maxScore = -1;

            box.querySelectorAll('.search-result-link').forEach(row => {
                const linkEl = row.querySelector('.search-link');
                if (!linkEl || !sameUrl(linkEl.href, targetUrl)) return;

                const scoreEl = row.querySelector('.search-score');
                const commentsEl = row.querySelector('.search-comments');

                const score = parseInt((scoreEl?.textContent || '0').match(/\d+/)?.[0] || '0', 10);
                const count = parseInt((commentsEl?.textContent || '0').replace(/,/g, '').match(/\d+/)?.[0] || '0', 10);

                if (score > maxScore) {
                    maxScore = score;
                    let href = (commentsEl || linkEl).href;
                    if (href) {
                        try {
                            const u = new URL(href);
                            href = u.pathname + u.search + u.hash;
                        } catch {}
                    }
                    if (href && (href.startsWith('/r/') || href.startsWith('/user/'))) {
                        best = { count, link: href };
                    }
                }
            });
            return best;
        } catch(e) { console.warn('Newsit: parseReddit error', e); return null; }
    }

    function parseHN(json) {
        try {
            if (!json.nbHits) return null;
            const top = json.hits.reduce((a, b) => (b.points > a.points ? b : a), json.hits[0]);
            if (!top || top.num_comments === 0) return null;

            const id = String(top.objectID).replace(/[^a-zA-Z0-9]/g, '');
            return {
                count: top.num_comments,
                link: `https://news.ycombinator.com/item?id=${id}`
            };
        } catch(e) { console.warn('Newsit: parseHN error', e); return null; }
    }

    async function req(url, type) {
        const prefix = type === 'rd' ? cfg.cachePrefix.rd : cfg.cachePrefix.hn;
        const cached = readCache(prefix, url);
        if (cached !== null) return cached;

        if (!await waitLimit()) return null;

        return new Promise(resolve => {
            const isRd = type === 'rd';
            const endpoint = isRd
                ? `https://old.reddit.com/search?q=url:${encodeURIComponent(url)}&sort=top`
                : `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(url)}&restrictSearchableAttributes=url&tags=story`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: endpoint,
                timeout: cfg.apiTimeout,
                onload(res) {
                    freeLimit();
                    if (res.status >= 200 && res.status < 300) {
                        let result = null;
                        if (isRd) result = parseReddit(res.responseText, url);
                        else result = parseHN(JSON.parse(res.responseText));
                        writeCache(prefix, url, result);
                        resolve(result);
                    } else resolve(null);
                },
                onerror(e) { console.error('Newsit: API Error', e); freeLimit(); resolve(null); },
                ontimeout() { console.warn('Newsit: API Timeout'); freeLimit(); resolve(null); }
            });
        });
    }

    GM_addStyle(`
        .ns-row { display:flex; align-items:center; gap:12px; margin-top:6px; font-size:0.85em; color:var(--text-dim,#888); font-family:var(--font-main,sans-serif); min-height:20px }
        .ns-link { display:flex; align-items:center; text-decoration:none; color:inherit; transition:color .2s; background:transparent }
        .ns-link:hover { color:var(--link-color,#8ab4f8) }
        .ns-ico { width:16px; height:16px; margin-right:6px; vertical-align:middle; border-radius:2px }
        .ns-cnt { line-height:normal }
    `);

    function render(type, data) {
        if (!data || !data.link) return null;

        let href = data.link;
        const isRd = type === 'rd';

        if (isRd) {
            const domain = useOldReddit ? 'https://old.reddit.com' : 'https://www.reddit.com';
            if (href.startsWith('/')) href = domain + href;
            else {
                if (useOldReddit) href = href.replace('www.reddit.com', 'old.reddit.com');
                else href = href.replace('old.reddit.com', 'www.reddit.com');
            }
        }

        if (!href.startsWith('http') && !href.startsWith('/')) return null;

        const icon = create('img', 'ns-ico');
        icon.src = isRd ? cfg.icons.rd : cfg.icons.hn;
        icon.alt = type;

        const text = create('span', 'ns-cnt');
        text.textContent = `${data.count || 0} comments`;

        const a = create('a', 'ns-link', [icon, text]);
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = `View ${type} discussion`;

        return a;
    }

    function findLink(el) {
        const hover = el.querySelector('a.hover');
        if (hover?.href) return hover.href;

        const title = el.querySelector('.title');
        const parent = title?.closest('a');
        if (parent?.href) return parent.href;

        const links = el.querySelectorAll('a[href]');
        for (const l of links) {
            const h = l.href;
            if (!l.classList.contains('list') &&
                !l.classList.contains('part') &&
                !h.includes('/proxy?') &&
                !h.includes('/favicon?')) return h;
        }
        return null;
    }

    function process(el) {
        if (el.dataset.nsFlag) return;
        el.dataset.nsFlag = '1';

        const url = findLink(el);
        if (!url) return;

        Promise.allSettled([
            req(url, 'rd'),
            req(url, 'hn')
        ]).then(results => {
            const [rd, hn] = results.map(r => r.status === 'fulfilled' ? r.value : null);

            if (rd || hn) {
                const row = create('div', 'ns-row');
                if (hn) {
                    const l = render('hn', hn);
                    if (l) row.appendChild(l);
                }
                if (rd) {
                    const l = render('rd', rd);
                    if (l) row.appendChild(l);
                }
                if (row.children.length > 0) el.appendChild(row);
            }
        });
    }

    const pending = new WeakMap();
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const t = setTimeout(() => {
                    process(entry.target);
                    obs.unobserve(entry.target);
                }, cfg.debounce);
                pending.set(entry.target, t);
            } else {
                const t = pending.get(entry.target);
                if (t) { clearTimeout(t); pending.delete(entry.target); }
            }
        });
    }, { rootMargin: '200px' });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { gc(); scan(document); });
    else { gc(); scan(document); }

    new MutationObserver(muts => {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches('.text-result, .media-result, .image-result')) {
                        if (!node.dataset.nsWatched) {
                            node.dataset.nsWatched = '1';
                            observer.observe(node);
                        }
                    }
                    else {
                        scan(node);
                    }
                }
            }
        }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });

    function scan(root) {
        root.querySelectorAll('.text-result, .media-result, .image-result').forEach(el => {
            if (!el.dataset.nsWatched) {
                el.dataset.nsWatched = '1';
                observer.observe(el);
            }
        });
    }

})();