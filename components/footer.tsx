export default function Footer({isDark}: {isDark: boolean}) {
    return (
<div className={`px-6 py-4 ${isDark 
                    ? 'bg-gradient-to-br from-black via-slate-900 to-black text-white' 
                            : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'
              }`}>
    <div className="max-w-7xl mx-auto px-6">
<div className="text-center">
    <div className="text-sm text-gray-500 mb-2">
        © 2025 Sourena Khanzadeh
    </div>
    <div className="text-xs text-gray-400">
        AI Researcher & Developer
            </div>
        </div>
        </div>
    </div>
    );
}