import * as vscode from "vscode";
import { AppInsightsClient } from "./appInsightsClient";
import { Logger } from "./logger";
import { TestNode } from "./testNode";

export class GotoTest {

    public go(test: TestNode): void {

        AppInsightsClient.sendEvent("gotoTest");

        const symbolInformation = vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            "vscode.executeWorkspaceSymbolProvider",
            test.fqn,
        ).then((symbols) => {

            let symbol: vscode.SymbolInformation;

            try {
                symbol = this.findTestLocation(symbols, test);

                vscode.workspace.openTextDocument(symbol.location.uri).then((doc) => {
                    vscode.window.showTextDocument(doc).then((editor) => {
                        const loc = symbol.location.range;
                        const selection = new vscode.Selection(loc.start.line, loc.start.character, loc.start.line, loc.end.character);
                        vscode.window.activeTextEditor.selection = selection;
                        vscode.window.activeTextEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                    });
                });

            } catch (r) {
                Logger.Log(r.message);
                vscode.window.showWarningMessage(r.message);
            }

        });
    }

    public findTestLocation(symbols: vscode.SymbolInformation[], testNode: TestNode): vscode.SymbolInformation {

        if (symbols.length === 0) {
            throw new Error("Could not find test (no symbols found)");
        }

        const testName = this.getTestName(testNode.name);

        symbols = symbols.filter((s) => this.isSymbolATestCandidate(s) && this.getTestName(s.name) === testName);

        if (symbols.length === 0) {
            throw Error("Could not find test (no symbols matching)");
        }

        if (symbols.length > 1) {
            throw Error("Could not find test (found multiple matching symbols)");
        }

        return symbols[0];
    }

    public getTestName(testName: string): string {
        const lastDotIndex = testName.lastIndexOf(".");

        if (lastDotIndex > -1) {
            testName = testName.substring(lastDotIndex + 1);
        }

        // XUnit theories are in the format MethodName(paramName: paramValue) and when need to search just for the MethodName
        return testName.replace(/(.*)(\(.*)/, "$1");
    }

    public getTestNamespace(testNode: TestNode): string {

        if (testNode.parentPath.length === 0) {
            const testName = this.getTestName(testNode.name);
            return testNode.name.substring(0, testNode.name.indexOf(testName) - 1);
        }

        return testNode.parentPath;
    }

    private isSymbolATestCandidate(s: vscode.SymbolInformation): boolean {
        return s.location.uri.toString().endsWith(".fs") ? s.kind === vscode.SymbolKind.Variable : s.kind === vscode.SymbolKind.Method;
    }
}
