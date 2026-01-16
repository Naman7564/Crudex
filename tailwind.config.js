/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f0faff',
                    100: '#e0f4fe',
                    200: '#b9eafa',
                    300: '#7cdcf9',
                    400: '#36cdf6',
                    500: '#00a0e9', // Doraemon Blue
                    600: '#0081cc',
                    700: '#0066a4',
                    800: '#005586',
                    900: '#00476f',
                },
                doraemon: {
                    red: '#dd0000', // Nose/Tail
                    yellow: '#f8c51e', // Bell
                    white: '#ffffff',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
