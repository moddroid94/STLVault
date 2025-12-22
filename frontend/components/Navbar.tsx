import React from 'react';
import { Menu, Settings as SettingsIcon } from 'lucide-react';

interface NavbarProps {
	title?: string;
	subtitle?: string;
	onOpenSidebar?: () => void;
	onOpenSettings?: () => void;
	showMenuButton?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
	title = 'STL Vault',
	subtitle,
	onOpenSidebar,
	onOpenSettings,
	showMenuButton = true
}) => {
	return (
		<header className="h-14 shrink-0 bg-vault-900 border-b border-vault-700 flex items-center px-3 gap-3">
			{showMenuButton && (
				<button
					type="button"
					onClick={onOpenSidebar}
					className="w-10 h-10 rounded-lg bg-vault-800 hover:bg-vault-700 border border-vault-700 flex items-center justify-center text-slate-200"
					aria-label="Open sidebar"
				>
					<Menu className="w-5 h-5" />
				</button>
			)}

			<div className="min-w-0 flex-1">
				<div className="text-sm font-semibold text-white truncate">{title}</div>
				{subtitle && <div className="text-xs text-slate-400 truncate">{subtitle}</div>}
			</div>

			<button
				type="button"
				onClick={onOpenSettings}
				className="w-10 h-10 rounded-lg bg-vault-800 hover:bg-vault-700 border border-vault-700 flex items-center justify-center text-slate-200"
				aria-label="Open settings"
			>
				<SettingsIcon className="w-5 h-5" />
			</button>
		</header>
	);
};

export default Navbar;

