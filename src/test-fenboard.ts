import fs from "node:fs/promises"
import path from "node:path"
import { serve } from "bun"
import ReactDOMServer from "react-dom/server"
import { FenBoard } from "./components/FenBoard"

const preview =
	"3507294839596955732847992643998603144230404160747745650424999983"

// Generate static HTML
const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FenBoard Test</title>
    <style>        
        body { 
            margin: 0; 
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI (Custom)", Roboto, "Helvetica Neue", "Open Sans (Custom)", system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
        }
        #fen-board { 
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 1px solid #ccc;
            border-radius: 8px;
        }
        svg text {
            font-weight: normal;
        }
        .fen-board-container {
            position: relative;
            user-select: none;
            border-radius: 0.5rem;
            padding: 10px;
        }
        .fen-board-container:focus-visible {
            outline: 2px solid rgb(245, 158, 11);
            outline-offset: 2px;
        }
        .pieces-container {
            pointer-events: none;
            position: absolute;
            inset: 10px;
            height: 100%;
            width: 100%;
        }
        .piece-wrapper {
            position: absolute;
            inset: 0;
        }
    </style>
</head>
<body>
    <div id="fen-board">
        ${ReactDOMServer.renderToString(FenBoard({ data: preview }))}
    </div>
    <script>
        console.log("FenBoard test page loaded");
    </script>
</body>
</html>
`

// Start server
const server = serve({
	port: 3000,
	fetch(req) {
		const url = new URL(req.url)

		if (url.pathname === "/") {
			return new Response(html, {
				headers: {
					"Content-Type": "text/html; charset=utf-8"
				}
			})
		}

		return new Response("Not found", { status: 404 })
	}
})

console.log("Server running at http://localhost:3000")
