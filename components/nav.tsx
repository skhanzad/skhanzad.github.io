"use client"
import Link from "next/link";
import { ProjectorIcon, BotIcon, ContactIcon, BookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface MenuItem{
    name: string;
    href: string;
    icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
    {
        name: "Projects",
        href: "/projects",
        icon: <ProjectorIcon />
    },
    {
        name: "AI Experiments",
        href: "/ai-experiments",
        icon: <BotIcon />
    },

    {
        name: "Thesis",
        href: "/thesis",
        icon: <BookIcon />
    },
    {
        name: "Contact",
        href: "/contact",
        icon: <ContactIcon />
    },
]



export function WheelMenu(){
    const router = useRouter();
    return (
        <div className="flex gap-4">
            {menuItems.map((item) => (
                <Link href={item.href} key={item.name} className="flex items-center gap-2">
                    {item.icon} {item.name}
                </Link>
            ))}
        </div>
    )
}


export default function Nav() {
    return (
        <header className="bg-white/10 backdrop-blur-sm w-full">
            <nav aria-label="Global" className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8">
                <Link href="/">
                <h1 className="text-4xl font-bold">S<span className="text-purple-200">K</span></h1>
                </Link>
                <WheelMenu />
            </nav>
        </header>
    );
}