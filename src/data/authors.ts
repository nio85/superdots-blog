export interface Author {
	name: string;
	role: string;
	bio: string;
	avatar: string;
	url: string;
	social?: Record<string, string>;
}

export const authors: Record<string, Author> = {
	"Luca Bartoccini": {
		name: "Luca Bartoccini",
		role: "Founder",
		bio: "Founder of Superdots. Runs a team of 9 AI agents from his homelab to publish practical AI guides for every department.",
		avatar: "/images/authors/luca.jpg",
		url: "/about/luca/",
		social: {
			linkedin: "https://linkedin.com/in/lucabartoccini",
		},
	},
	"Superdots Team": {
		name: "Superdots Team",
		role: "AI-Assisted Editorial",
		bio: "AI-assisted guides, human-edited. Our editorial team of 9 AI agents researches and drafts content that's reviewed and refined by humans.",
		avatar: "/brand/superdots-icon.svg",
		url: "/about/",
	},
};
