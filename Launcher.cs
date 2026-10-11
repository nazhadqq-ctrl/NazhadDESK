using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace NazhaDesk
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = Path.Combine(baseDir, "node.exe");
            if (!File.Exists(nodePath))
            {
                nodePath = "node";
            }

            string serverScript = Path.Combine(baseDir, "server.js");

            Process serverProcess = null;
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + serverScript + "\"";
                psi.WorkingDirectory = baseDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;

                serverProcess = Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("هەڵە لە دەستپێکردنی سێرڤەری NazhaDesk:\n" + ex.Message, "NazhaDesk", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Wait briefly for server startup
            Thread.Sleep(1000);

            // Find best browser executable for native app-window mode
            string browserPath = null;
            string onlineUrl = "https://choice-tyler-horizon-ghz.trycloudflare.com";

            string[] possibleBrowsers = new string[] {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string path in possibleBrowsers)
            {
                if (File.Exists(path))
                {
                    browserPath = path;
                    break;
                }
            }

            try
            {
                if (!string.IsNullOrEmpty(browserPath))
                {
                    ProcessStartInfo appPsi = new ProcessStartInfo();
                    appPsi.FileName = browserPath;
                    appPsi.Arguments = "--app=\"" + onlineUrl + "\" --window-size=1320,860";
                    appPsi.UseShellExecute = false;

                    Process appProc = Process.Start(appPsi);
                    appProc.WaitForExit();
                }
                else
                {
                    ProcessStartInfo urlPsi = new ProcessStartInfo(onlineUrl);
                    urlPsi.UseShellExecute = true;
                    Process.Start(urlPsi);
                }
            }
            catch
            {
                try
                {
                    ProcessStartInfo fallback = new ProcessStartInfo(onlineUrl);
                    fallback.UseShellExecute = true;
                    Process.Start(fallback);
                }
                catch { }
            }

            // Clean up server process when window closes
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
            }
            catch { }
        }
    }
}
