import Nav from "@/components/nav";

export default function Home() {
  return (
    <main className="bg-background flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-500 to-white">
      <Nav />
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-5xl font-bold">Welcome to my portfolio</h1>
        <p className="text-lg">
          I'm a software engineer with a passion for building applications.
        </p>
      </div>
    </main>
  );
}
