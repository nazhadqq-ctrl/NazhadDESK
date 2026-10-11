using System;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using System.Diagnostics;
using Microsoft.Win32;

namespace NazhaDeskSetup
{
    public class SetupForm : Form
    {
        private int currentStep = 0;
        private Panel headerPanel;
        private Label lblHeaderTitle;
        private Label lblHeaderSub;
        private Panel contentPanel;
        private Panel buttonPanel;
        private Button btnBack;
        private Button btnNext;
        private Button btnCancel;

        // Steps
        private Panel panelStep0; // Welcome
        private Panel panelStep1; // Directory
        private Panel panelStep2; // Progress
        private Panel panelStep3; // Finish

        private TextBox txtInstallPath;
        private CheckBox chkDesktopShortcut;
        private CheckBox chkStartMenuShortcut;
        private ProgressBar progressBar;
        private Label lblProgressStatus;
        private CheckBox chkLaunchNow;

        private string defaultInstallDir;

        public SetupForm()
        {
            defaultInstallDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NazhaDesk");

            this.Text = "دابەزاندنی سیستەمی NazhaDesk (AnyDesk Alternative Setup)";
            this.Size = new Size(640, 460);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;
            this.Font = new Font("Segoe UI", 10f, FontStyle.Regular);
            this.BackColor = Color.FromArgb(248, 250, 252);

            InitializeComponents();
            ShowStep(0);
        }

        private void InitializeComponents()
        {
            // Header
            headerPanel = new Panel();
            headerPanel.Dock = DockStyle.Top;
            headerPanel.Height = 75;
            headerPanel.BackColor = Color.FromArgb(226, 35, 26); // AnyDesk Crimson Red

            lblHeaderTitle = new Label();
            lblHeaderTitle.Text = "بەخێربێن بۆ دابەزاندنی NazhaDesk";
            lblHeaderTitle.Font = new Font("Segoe UI", 13f, FontStyle.Bold);
            lblHeaderTitle.ForeColor = Color.White;
            lblHeaderTitle.Location = new Point(20, 14);
            lblHeaderTitle.AutoSize = true;
            headerPanel.Controls.Add(lblHeaderTitle);

            lblHeaderSub = new Label();
            lblHeaderSub.Text = "سیستەمی خێرا و سەربەخۆی کۆنترۆڵکردنی کۆمپیوتەر لە دوورەوە (Full Control)";
            lblHeaderSub.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            lblHeaderSub.ForeColor = Color.FromArgb(254, 226, 226);
            lblHeaderSub.Location = new Point(20, 42);
            lblHeaderSub.AutoSize = true;
            headerPanel.Controls.Add(lblHeaderSub);

            this.Controls.Add(headerPanel);

            // Bottom Buttons
            buttonPanel = new Panel();
            buttonPanel.Dock = DockStyle.Bottom;
            buttonPanel.Height = 60;
            buttonPanel.BackColor = Color.FromArgb(241, 245, 249);

            btnCancel = new Button();
            btnCancel.Text = "پاشگەزبوونەوە";
            btnCancel.Location = new Point(20, 15);
            btnCancel.Size = new Size(110, 34);
            btnCancel.Click += (s, e) => this.Close();
            buttonPanel.Controls.Add(btnCancel);

            btnNext = new Button();
            btnNext.Text = "دواتر >";
            btnNext.Location = new Point(500, 15);
            btnNext.Size = new Size(110, 34);
            btnNext.BackColor = Color.FromArgb(226, 35, 26);
            btnNext.ForeColor = Color.White;
            btnNext.FlatStyle = FlatStyle.Flat;
            btnNext.Click += BtnNext_Click;
            buttonPanel.Controls.Add(btnNext);

            btnBack = new Button();
            btnBack.Text = "< پێشوو";
            btnBack.Location = new Point(380, 15);
            btnBack.Size = new Size(110, 34);
            btnBack.Click += (s, e) => { if (currentStep > 0) ShowStep(currentStep - 1); };
            buttonPanel.Controls.Add(btnBack);

            this.Controls.Add(buttonPanel);

            // Content Panel
            contentPanel = new Panel();
            contentPanel.Dock = DockStyle.Fill;
            contentPanel.Padding = new Padding(25);
            this.Controls.Add(contentPanel);

            // Step 0: Welcome
            panelStep0 = new Panel { Dock = DockStyle.Fill };
            Label lblWelcome = new Label();
            lblWelcome.Text = "ئەم ویزاردە بەرنامەی NazhaDesk لەسەر ئەم کۆمپیوتەرە دادەمەزرێنێت.\n\n" +
                              "• کۆنترۆڵی تەواوی ماوس و کیبۆرد بە خێرایی بەرز\n" +
                              "• پەخشی شاشە بە کوالیتی 1080p بەبێ پچڕان\n" +
                              "• ژمارەی ناسێنەری ٩ ژمارەیی هاوشێوەی AnyDesk\n" +
                              "• بەبێ پێویستی بە ئەکاونت یان کڕینی بەشداریکردن\n\n" +
                              "تکایە کلیک لەسەر 'دواتر' بکە بۆ بەردەوامبوون.";
            lblWelcome.Font = new Font("Segoe UI", 10.5f);
            lblWelcome.Location = new Point(20, 20);
            lblWelcome.Size = new Size(560, 200);
            panelStep0.Controls.Add(lblWelcome);

            // Step 1: Directory & Options
            panelStep1 = new Panel { Dock = DockStyle.Fill };
            Label lblDir = new Label { Text = "شوێنی دابەزاندنی بەرنامە دیاری بکە:", Location = new Point(20, 20), AutoSize = true };
            panelStep1.Controls.Add(lblDir);

            txtInstallPath = new TextBox { Text = defaultInstallDir, Location = new Point(20, 50), Width = 450, ReadOnly = true };
            panelStep1.Controls.Add(txtInstallPath);

            Button btnBrowse = new Button { Text = "گەڕان...", Location = new Point(480, 48), Size = new Size(80, 30) };
            btnBrowse.Click += (s, e) => {
                FolderBrowserDialog fbd = new FolderBrowserDialog();
                if (fbd.ShowDialog() == DialogResult.OK) {
                    txtInstallPath.Text = Path.Combine(fbd.SelectedPath, "NazhaDesk");
                }
            };
            panelStep1.Controls.Add(btnBrowse);

            chkDesktopShortcut = new CheckBox { Text = "دروستکردنی ئایکۆنی کورتکراوە لەسەر ڕووی شاشە (Desktop Shortcut)", Checked = true, Location = new Point(20, 110), AutoSize = true };
            panelStep1.Controls.Add(chkDesktopShortcut);

            chkStartMenuShortcut = new CheckBox { Text = "زیادکردن بۆ لیستی دەستپێک (Start Menu)", Checked = true, Location = new Point(20, 145), AutoSize = true };
            panelStep1.Controls.Add(chkStartMenuShortcut);

            // Step 2: Progress
            panelStep2 = new Panel { Dock = DockStyle.Fill };
            lblProgressStatus = new Label { Text = "فایلەکان دادەبەزێنرێن...", Location = new Point(20, 40), AutoSize = true };
            panelStep2.Controls.Add(lblProgressStatus);

            progressBar = new ProgressBar { Location = new Point(20, 80), Size = new Size(540, 25), Style = ProgressBarStyle.Continuous };
            panelStep2.Controls.Add(progressBar);

            // Step 3: Finish
            panelStep3 = new Panel { Dock = DockStyle.Fill };
            Label lblDone = new Label { 
                Text = "پیرۆزە! بەرنامەی NazhaDesk بە سەرکەوتوویی دابەزێندرا.\n\nئێستا دەتوانیت پەیوەندی بە شوێنەکانی ترەوە بکەیت یان ڕێگە بدەیت کۆمپیوتەرەکەت کۆنترۆڵ بکرێت.",
                Font = new Font("Segoe UI", 11f, FontStyle.Bold),
                Location = new Point(20, 30),
                Size = new Size(550, 100)
            };
            panelStep3.Controls.Add(lblDone);

            chkLaunchNow = new CheckBox { Text = "دەستبەجێ کردنەوەی بەرنامەی NazhaDesk", Checked = true, Location = new Point(20, 150), AutoSize = true };
            panelStep3.Controls.Add(chkLaunchNow);
        }

        private void ShowStep(int step)
        {
            currentStep = step;
            contentPanel.Controls.Clear();

            btnBack.Visible = (step > 0 && step < 2);
            btnCancel.Visible = (step < 3);

            if (step == 0)
            {
                lblHeaderTitle.Text = "بەخێربێن بۆ دابەزاندنی NazhaDesk";
                btnNext.Text = "دواتر >";
                contentPanel.Controls.Add(panelStep0);
            }
            else if (step == 1)
            {
                lblHeaderTitle.Text = "شوێنی دابەزاندن و ڕێکخستنەکان";
                btnNext.Text = "دابەزاندن (Install)";
                contentPanel.Controls.Add(panelStep1);
            }
            else if (step == 2)
            {
                lblHeaderTitle.Text = "دابەزاندنی فایلەکان";
                btnNext.Enabled = false;
                btnBack.Enabled = false;
                contentPanel.Controls.Add(panelStep2);
                StartInstall();
            }
            else if (step == 3)
            {
                lblHeaderTitle.Text = "دابەزاندن تەواو بوو";
                btnNext.Text = "کۆتایی (Finish)";
                btnNext.Enabled = true;
                contentPanel.Controls.Add(panelStep3);
            }
        }

        private void BtnNext_Click(object sender, EventArgs e)
        {
            if (currentStep == 0)
            {
                ShowStep(1);
            }
            else if (currentStep == 1)
            {
                ShowStep(2);
            }
            else if (currentStep == 3)
            {
                if (chkLaunchNow.Checked)
                {
                    string targetExe = Path.Combine(txtInstallPath.Text, "NazhaDesk.exe");
                    if (File.Exists(targetExe))
                    {
                        ProcessStartInfo psi = new ProcessStartInfo(targetExe);
                        psi.WorkingDirectory = txtInstallPath.Text;
                        Process.Start(psi);
                    }
                }
                this.Close();
            }
        }

        private void StartInstall()
        {
            Thread t = new Thread(() => {
                try
                {
                    string targetDir = txtInstallPath.Text;
                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }

                    UpdateProgress(20, "دەرهێنانی فایلەکانی سیستەم لە کڕۆکەوە...");

                    // 1. Try to extract from embedded resource Payload
                    bool extractedFromResource = false;
                    Assembly asm = Assembly.GetExecutingAssembly();
                    Stream resStream = asm.GetManifestResourceStream("Payload");
                    if (resStream != null)
                    {
                        string tempZip = Path.Combine(Path.GetTempPath(), "nazhadesk_payload_" + Guid.NewGuid().ToString("N") + ".zip");
                        using (FileStream fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                        {
                            byte[] buffer = new byte[65536];
                            int read;
                            while ((read = resStream.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                fs.Write(buffer, 0, read);
                            }
                        }
                        resStream.Close();

                        UpdateProgress(50, "دابەزاندنی فایلەکان لە پەڕگەی سەرەکی...");
                        ZipFile.ExtractToDirectory(tempZip, targetDir);

                        try { File.Delete(tempZip); } catch { }
                        extractedFromResource = true;
                    }

                    // 2. Fallback to extracting external payload.zip or copying from local directory
                    if (!extractedFromResource)
                    {
                        string localPayloadZip = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "payload.zip");
                        if (File.Exists(localPayloadZip))
                        {
                            UpdateProgress(50, "دەرهێنانی فایلی payload.zip...");
                            ZipFile.ExtractToDirectory(localPayloadZip, targetDir);
                        }
                        else
                        {
                            // Copy local files
                            string sourceDir = AppDomain.CurrentDomain.BaseDirectory;
                            CopyDirectory(sourceDir, targetDir);
                        }
                    }

                    UpdateProgress(80, "دروستکردنی ئایکۆنی ڕووی شاشە (Desktop Shortcut)...");

                    string targetExe = Path.Combine(targetDir, "NazhaDesk.exe");

                    // Create shortcuts
                    if (chkDesktopShortcut.Checked)
                    {
                        // 1. Regular desktop
                        string desktop1 = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                        CreateShortcutReliable(Path.Combine(desktop1, "NazhaDesk.lnk"), targetExe, targetDir);

                        // 2. OneDrive Desktop if present
                        string oneDriveDesktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "OneDrive", "Desktop");
                        if (Directory.Exists(oneDriveDesktop))
                        {
                            CreateShortcutReliable(Path.Combine(oneDriveDesktop, "NazhaDesk.lnk"), targetExe, targetDir);
                        }

                        // 3. User Shell Folders Desktop via registry
                        try
                        {
                            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders"))
                            {
                                if (key != null)
                                {
                                    string regDesktop = key.GetValue("Desktop") as string;
                                    if (!string.IsNullOrEmpty(regDesktop))
                                    {
                                        regDesktop = Environment.ExpandEnvironmentVariables(regDesktop);
                                        if (Directory.Exists(regDesktop))
                                        {
                                            CreateShortcutReliable(Path.Combine(regDesktop, "NazhaDesk.lnk"), targetExe, targetDir);
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }

                    if (chkStartMenuShortcut.Checked)
                    {
                        string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NazhaDesk");
                        if (!Directory.Exists(startMenuPath)) Directory.CreateDirectory(startMenuPath);
                        CreateShortcutReliable(Path.Combine(startMenuPath, "NazhaDesk.lnk"), targetExe, targetDir);
                    }

                    UpdateProgress(100, "دابەزاندن بە سەرکەوتوویی تەواو بوو!");
                    Thread.Sleep(400);

                    this.Invoke(new Action(() => ShowStep(3)));
                }
                catch (Exception ex)
                {
                    MessageBox.Show("هەڵە لە کاتی دابەزاندندا:\n" + ex.Message, "هەڵە", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        private void UpdateProgress(int val, string status)
        {
            this.Invoke(new Action(() => {
                progressBar.Value = Math.Min(100, val);
                lblProgressStatus.Text = status;
            }));
        }

        private static void CopyDirectory(string sourceDir, string destinationDir)
        {
            Directory.CreateDirectory(destinationDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string fileName = Path.GetFileName(file);
                if (fileName.Equals("Setup-NazhaDesk.exe", StringComparison.OrdinalIgnoreCase)) continue;
                string destFile = Path.Combine(destinationDir, fileName);
                try { File.Copy(file, destFile, true); } catch { }
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                string subName = Path.GetFileName(subDir);
                string destSubDir = Path.Combine(destinationDir, subName);
                CopyDirectory(subDir, destSubDir);
            }
        }

        private static void CreateShortcutReliable(string shortcutPath, string targetPath, string workingDir)
        {
            try
            {
                string psScript = string.Format(
                    "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('{0}'); $s.TargetPath = '{1}'; $s.WorkingDirectory = '{2}'; $s.Description = 'NazhaDesk Remote Desktop'; $s.Save()",
                    shortcutPath.Replace("'", "''"),
                    targetPath.Replace("'", "''"),
                    workingDir.Replace("'", "''")
                );

                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -Command \"" + psScript + "\"");
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                Process p = Process.Start(psi);
                p.WaitForExit(5000);
            }
            catch { }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
