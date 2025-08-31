const esbuild = require("esbuild");
const path = require("path");

async function build() {
    try {
        await esbuild.build({
            entryPoints: [
                "src/main.ts",
                "src/preload.ts",
                "build-info.ts"
            ],
            bundle: true,
            platform: "node",
            target: "node20",
            outdir: "dist",
            format: "cjs", // CommonJS 출력
            sourcemap: false,
            minify: true,
            external: ["electron"],
        });

        console.log("✅ Build complete!");
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

build();
