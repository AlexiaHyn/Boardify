import "~/styles/globals.css";

import type { Metadata } from "next";
import { Cinzel, Crimson_Pro } from "next/font/google";

export const metadata: Metadata = {
	title: "Boardify – Conjure Your Next Great Game",
	description:
		"Describe a board game idea and watch it materialize into a complete blueprint, powered by AI.",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const cinzel = Cinzel({
	subsets: ["latin"],
	variable: "--font-display",
	weight: ["400", "500", "600", "700"],
});

const crimsonPro = Crimson_Pro({
	subsets: ["latin"],
	variable: "--font-body",
	weight: ["300", "400", "500", "600", "700"],
	style: ["normal", "italic"],
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html className={`${cinzel.variable} ${crimsonPro.variable}`} lang="en">
			<body>{children}</body>
		</html>
	);
}
