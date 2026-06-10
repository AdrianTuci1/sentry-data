"use client";;
import { useCallback, useEffect, useMemo, useRef } from "react";

const MODS = ["ctrl", "alt", "shift", "meta"];

const isMod = p => (MODS).includes(p);

const IGNORE_FOCUS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function normalize(combo) {
	const parts = combo
		.toLowerCase()
		.split("+")
		.map((s) => s.trim());
	const M = MODS;
	const mods = parts.filter(isMod).sort((a, b) => M.indexOf(a) - M.indexOf(b));
	const keys = parts.filter((p) => !isMod(p));
	return [...mods, ...keys].join("+");
}

function matches(e, norm) {
	const segs = norm.split("+");
	const wantMods = segs.filter(isMod);
	const wantKey = segs.find((p) => !isMod(p));
	const haveMods = [
		e.ctrlKey && "ctrl",
		e.altKey && "alt",
		e.shiftKey && "shift",
		e.metaKey && "meta",
	].filter(Boolean);

	if (
		wantMods.length !== haveMods.length ||
		!wantMods.every((m) => haveMods.includes(m))
	) {
		return false;
	}
	return e.key.toLowerCase() === wantKey;
}

/**
 * Listens for `keydown` shortcut chords. Skips firing while focus is in an input,
 * textarea, select, or `contentEditable` region.
 */
export function useKeypress({
    combo,
    callback,
    preventDefault = true,
    target
}) {
	const callbackRef = useRef(callback);
	useEffect(() => {
		callbackRef.current = callback;
	}, [callback]);

	const normalized = useMemo(() => (Array.isArray(combo) ? combo : [combo]).map(normalize), [combo]);

	const onKeyDown = useCallback((ev) => {
        const e = ev;
        const el = e.target;
        if (IGNORE_FOCUS.has(el?.tagName ?? "") || el?.isContentEditable) {
            return;
        }
        for (const chord of normalized) {
            if (!matches(e, chord)) {
                continue;
            }
            if (preventDefault) {
                e.preventDefault();
            }
            callbackRef.current(e);
            break;
        }
    }, [normalized, preventDefault]);

	useEffect(() => {
		const el = target ?? window;
		el.addEventListener("keydown", onKeyDown);
		return () => el.removeEventListener("keydown", onKeyDown);
	}, [onKeyDown, target]);
}
