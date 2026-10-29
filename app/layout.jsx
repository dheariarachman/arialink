import './globals.css';
export const metadata={title:'ARIALink — Catatan transaksi',description:'Pencatatan transaksi dan saldo usaha dalam satu tempat.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'ARIALink'},icons:{icon:'/icon.svg',apple:'/icon-192.png'}};
export const viewport={width:'device-width',initialScale:1,themeColor:'#111827'};
export default function Layout({children}){return <html lang="id"><body>{children}</body></html>;}
