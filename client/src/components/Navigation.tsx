import { useEffect, useState, type MouseEvent } from "react";
import { Link } from "wouter";
import { Menu, Phone, X } from "lucide-react";
import "./Navigation.css";

type NavigationProps = {
	onOpenCatalog?: () => void;
};

export function Navigation({ onOpenCatalog }: NavigationProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);

	const links = [
		{ label: "Магазин", href: "#shop" },
		{ label: "Каталог", href: "#collections" },
		{ label: "О нас", href: "#about" },
		{ label: "Контакты", href: "#journal" },
	];

	useEffect(() => {
		const prev = document.body.style.overflow;
		if (menuOpen) document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [menuOpen]);

	useEffect(() => {
		const onScroll = () => setIsScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const handleNavClick = (item: string) => (e: MouseEvent<HTMLAnchorElement>) => {
		if (item !== "Каталог" || !onOpenCatalog) return;
		e.preventDefault();
		onOpenCatalog();
	};

	const handleLinkClick = (item: string) => (e: MouseEvent<HTMLAnchorElement>) => {
		if (item === "Каталог" && onOpenCatalog) {
			e.preventDefault();
			onOpenCatalog();
		}
		setMenuOpen(false);
	};

	const handlePhoneClick = () => {
		const target = document.getElementById("footer-phone");
		if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
		setMenuOpen(false);
	};

	return (
		<header className={`nav-root ${isScrolled ? "nav-root--scrolled" : ""}`.trim()}>
			<div className="nav-inner">
				<Link href="/" className="nav-logo">
					AMINA ZARF
				</Link>

				<nav className="nav-links">
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="nav-link"
							onClick={handleNavClick(link.label)}
						>
							{link.label}
						</a>
					))}
				</nav>

				<div className="nav-actions">
					<button className="nav-cart" type="button" aria-label="Телефон" onClick={handlePhoneClick}>
						<Phone className="nav-cart-icon" />
					</button>
					<button
						className="nav-burger"
						type="button"
						aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
						aria-expanded={menuOpen}
						onClick={() => setMenuOpen((prev) => !prev)}
					>
						{menuOpen ? <X className="nav-burger-icon" /> : <Menu className="nav-burger-icon" />}
					</button>
				</div>
			</div>

			{menuOpen && (
				<div className="nav-mobile">
					<nav className="nav-mobile-links">
						{links.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="nav-mobile-link"
								onClick={handleLinkClick(link.label)}
							>
								{link.label}
							</a>
						))}
					</nav>
				</div>
			)}
		</header>
	);
}
