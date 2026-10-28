import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            manifest: {
                name: "R-DVNC2000",
                short_name: "R-DVNC2000",
                description: "Filmadora digital analógica no navegador",
                theme_color: "#fcee0a",
                background_color: "#0a0a0c",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "https://images.teepublic.com/derived/production/designs/35248606_0/1664322988/i_m:pid_477,c_99_76_1108x1108,bc_000000,ar_1x1,o_portrait,pm_4,s_630,q_90.jpg",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "https://images.teepublic.com/derived/production/designs/35248606_0/1664322988/i_m:pid_477,c_99_76_1108x1108,bc_000000,ar_1x1,o_portrait,pm_4,s_630,q_90.jpg",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },
        }),
    ],
});
