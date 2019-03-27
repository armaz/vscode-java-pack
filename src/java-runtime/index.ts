// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as expandTilde from "expand-tilde";
import * as pathExists from "path-exists";
import findJavaHome = require("find-java-home");

const isWindows = process.platform.indexOf("win") === 0;
const JAVAC_FILENAME = path.join("bin", "javac" + (isWindows ? ".exe" : "")) ;
const JAVA_FILENAME = path.join("bin", "java" + (isWindows ? ".exe" : ""));

async function getJavaVersion(javaHome: string | undefined): Promise<number> {
  if (!javaHome) {
    return Promise.resolve(0);
  }

  return new Promise<number>((resolve, reject) => {
    cp.execFile(path.resolve(javaHome, JAVA_FILENAME),["-version"], {}, (err, stdout, stderr) => {
      const regex = /version "(\d+)\.(\d+).*"/g;
      const match = regex.exec(stderr);
      if (!match) {
        resolve(0);
        return;
      }

      let major = parseInt(match[1]), minor = parseInt(match[2]);
      if (major === 1) {
        resolve(minor);
      }

      resolve(major);
    });
  });
}

async function findPossibleJdkInstallations(): Promise<{[location : string] : string | undefined}> {
  return new Promise((resolve, reject) => {
    const javaHomeEntries: {[location : string] : string | undefined} = {
      "java.home": vscode.workspace.getConfiguration().get("java.home", undefined),
      "JDK_HOME": process.env["JDK_HOME"],
      "JAVA_HOME": process.env["JAVA_HOME"],
      "java.other": undefined
    };

    findJavaHome({allowJre: false}, (err, home) => {
      if (!err) {
        javaHomeEntries.other = home;
      }

      resolve(javaHomeEntries);
    });
  });
}

async function validateJdkInstallation(javaHome: string | undefined) {
  if (!javaHome) {
    return false;
  }

  javaHome = expandTilde(javaHome);
  return await pathExists(path.resolve(javaHome, JAVAC_FILENAME));
}

export async function validateJavaRuntime() {
  const jdkEntries = await findPossibleJdkInstallations();
  for (const key in jdkEntries) {
    if (jdkEntries.hasOwnProperty(key)) {
      const entry = jdkEntries[key];
      if (await validateJdkInstallation(entry) && await getJavaVersion(entry) >= 8) {
        return true;
      }
    }
  }

  return false;
}