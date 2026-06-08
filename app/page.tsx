import HomePageClient from "@/components/home/HomePageClient";
import FeaturedBlogPosts from "@/components/FeaturedBlogPosts";

export default function Home() {
  return <HomePageClient featured={<FeaturedBlogPosts />} />;
}
