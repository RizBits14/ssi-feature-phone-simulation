/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import RootLayouts from "../Layouts/RootLayouts";

import HomeMenu from "../Pages/HomeMenu";
import Holder from "../Pages/Holder";
import Wallet from "../Pages/Wallet";
// import Issuer from "../Pages/Issuer";
// import Verifier from "../Pages/Verifier";

function Placeholder({ name }) {
    return (
        <div className="p-3 text-slate-100 text-[13px]">
            <div className="font-semibold">{name}</div>
            <div className="opacity-75 mt-2">We’ll add endpoints + screen later.</div>
        </div>
    );
}

const router = createBrowserRouter([
    {
        path: "/",
        element: <RootLayouts />,
        children: [
            { index: true, element: <HomeMenu /> },
            { path: "holder", element: <Holder /> },
            // { path: "issuer", element: <Issuer></Issuer> },
            // { path: "verifier", element: <Verifier></Verifier> },
            { path: "wallet", element: <Wallet /> },
        ],
    },
]);

export default router