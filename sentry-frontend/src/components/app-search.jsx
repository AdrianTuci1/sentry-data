"use client";

import { useRef } from "react";
import { useKeypress } from "@/hooks/use-keypress";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";

export function AppSearch() {
	const groupRef = useRef(null);
	const { setOpen } = useSidebar();

	useKeypress({
		combo: ["meta+k", "ctrl+k"],
		callback: () => {
			const input = groupRef.current?.querySelector("[data-slot=input-group-control]");
			input?.focus({ preventScroll: true });
			setOpen(true);
		},
	});

	return (
        <InputGroup ref={groupRef}>
            <InputGroupAddon align="inline-start" className="pl-1.75">
				<IconPlaceholder
                    hugeicons="SearchIcon"
                    lucide="SearchIcon"
                    phosphor="MagnifyingGlassIcon"
                    remixicon="RiSearchLine"
                    tabler="IconSearch" />
			</InputGroupAddon>
            <InputGroupInput aria-label="Search" name="q" placeholder="Search..." type="search" />
            <InputGroupAddon align="inline-end">
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>
			</InputGroupAddon>
        </InputGroup>
    );
}
