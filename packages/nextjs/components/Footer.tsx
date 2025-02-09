"use client";

import React from "react";
import Link from "next/link";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { HeartIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { BuidlGuidlLogo } from "~~/components/assets/BuidlGuidlLogo";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

/**
 * Site footer
 */
export const Footer = () => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div>
        <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <div className="flex space-x-2 pointer-events-auto">
            {nativeCurrencyPrice > 0 && (
              <div className="btn btn-primary btn-sm font-normal cursor-auto gap-0">
                <CurrencyDollarIcon className="h-4 w-4 mr-0.5" />
                <span>{nativeCurrencyPrice}</span>
              </div>
            )}
            {isLocalNetwork && (
              <div className="btn btn-primary btn-sm font-normal cursor-auto gap-0">
                <HeartIcon className="h-4 w-4 mr-0.5" />
                <span>Local Network</span>
              </div>
            )}
            <SwitchTheme className="pointer-events-auto" />
          </div>
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-2 text-sm w-full">
            <div className="text-center">
              <a href="https://github.com/scaffold-eth/se-2" target="_blank" rel="noreferrer" className="link">
                Built with SE2
              </a>
            </div>
            <span>·</span>
            <div className="flex justify-center items-center gap-2">
              <p className="m-0 text-center">
                Built by Johnson Lee 
              </p>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
