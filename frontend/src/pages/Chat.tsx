import { useState } from 'react';

export default function Chat() {
  const [message, setMessage] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // TODO: Handle sending message and streaming response
    console.log('Sending message:', message);
    setMessage('');
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-bold text-gray-900">AI-Hub Chat</h1>
        <div className="flex items-center gap-4">
          <button className="text-sm text-gray-600 hover:text-gray-900">Models</button>
          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Placeholder messages */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0"></div>
            <div className="prose text-gray-800">
              <p>Hello! How can I help you today?</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="p-4 border-t bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSend} className="flex gap-2">
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 rounded-md"
              title="Attach file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
            <input
              type="text"
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Message AI-Hub..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Send
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
