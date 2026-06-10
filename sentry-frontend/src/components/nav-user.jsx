"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const user = {
	name: "Shaban Haider",
	email: "shaban@efferd.com",
	avatar: "https://github.com/shabanhr.png",
};

export function NavUser() {
	return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
				<Avatar className="size-8">
					<AvatarImage src={user.avatar} />
					<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
				<DropdownMenuItem className="flex items-center justify-start gap-2">
					<DropdownMenuLabel className="flex items-center gap-3">
						<Avatar className="size-10">
							<AvatarImage src={user.avatar} />
							<AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
						</Avatar>
						<div>
							<span className="font-medium text-foreground">{user.name}</span>{" "}
							<br />
							<div
                                className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
								{user.email}
							</div>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<IconPlaceholder
                            hugeicons="UserMultipleIcon"
                            lucide="UserIcon"
                            phosphor="UserIcon"
                            remixicon="RiUserLine"
                            tabler="IconUser" />
						Account
					</DropdownMenuItem>
					<DropdownMenuItem>
						<IconPlaceholder
                            hugeicons="Settings01Icon"
                            lucide="SettingsIcon"
                            phosphor="GearIcon"
                            remixicon="RiSettings3Line"
                            tabler="IconSettings" />
						Settings
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem>
						<IconPlaceholder
                            hugeicons="CreditCardIcon"
                            lucide="CreditCardIcon"
                            phosphor="CreditCardIcon"
                            remixicon="RiBankCardLine"
                            tabler="IconCreditCard" />
						Plan & Billing
					</DropdownMenuItem>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem className="w-full cursor-pointer" variant="destructive">
						<IconPlaceholder
                            hugeicons="ArrowLeft01Icon"
                            lucide="LogOutIcon"
                            phosphor="CaretLeftIcon"
                            remixicon="RiArrowLeftSLine"
                            tabler="IconChevronLeft" />
						Log out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
        </DropdownMenu>
    );
}
