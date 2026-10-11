using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace NazhaDesk.Native
{
    class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")]
        static extern bool SetCursorPos(int X, int Y);

        const int SM_CXSCREEN = 0;
        const int SM_CYSCREEN = 1;

        const int INPUT_MOUSE = 0;
        const int INPUT_KEYBOARD = 1;

        const uint MOUSEEVENTF_MOVE = 0x0001;
        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        const uint MOUSEEVENTF_WHEEL = 0x0800;
        const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

        const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
        const uint KEYEVENTF_KEYUP = 0x0002;
        const uint KEYEVENTF_UNICODE = 0x0004;

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT
        {
            public uint type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        struct InputUnion
        {
            [FieldOffset(0)]
            public MOUSEINPUT mi;
            [FieldOffset(0)]
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        static void SendMouseInput(uint flags, int dx = 0, int dy = 0, uint mouseData = 0)
        {
            INPUT input = new INPUT();
            input.type = INPUT_MOUSE;
            input.u.mi.dwFlags = flags;
            input.u.mi.dx = dx;
            input.u.mi.dy = dy;
            input.u.mi.mouseData = mouseData;
            input.u.mi.time = 0;
            input.u.mi.dwExtraInfo = IntPtr.Zero;

            INPUT[] inputs = new INPUT[] { input };
            SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        static void SendKeyboardInput(ushort vk, uint flags, ushort scan = 0)
        {
            INPUT input = new INPUT();
            input.type = INPUT_KEYBOARD;
            input.u.ki.wVk = vk;
            input.u.ki.wScan = scan;
            input.u.ki.dwFlags = flags;
            input.u.ki.time = 0;
            input.u.ki.dwExtraInfo = IntPtr.Zero;

            INPUT[] inputs = new INPUT[] { input };
            SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        static void SendUnicodeChar(char ch)
        {
            INPUT input = new INPUT();
            input.type = INPUT_KEYBOARD;
            input.u.ki.wVk = 0;
            input.u.ki.wScan = (ushort)ch;
            input.u.ki.dwFlags = KEYEVENTF_UNICODE;
            input.u.ki.time = 0;
            input.u.ki.dwExtraInfo = IntPtr.Zero;

            INPUT inputUp = input;
            inputUp.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

            INPUT[] inputs = new INPUT[] { input, inputUp };
            SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        [STAThread]
        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.WriteLine("NAZHADESK_INPUT_READY");
            Console.Out.Flush();

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                if (line.Equals("EXIT", StringComparison.OrdinalIgnoreCase))
                {
                    break;
                }

                try
                {
                    string[] parts = line.Split(' ');
                    string cmd = parts[0].ToUpperInvariant();

                    if (cmd == "SCREEN")
                    {
                        int w = GetSystemMetrics(SM_CXSCREEN);
                        int h = GetSystemMetrics(SM_CYSCREEN);
                        Console.WriteLine("SCREEN " + w + " " + h);
                        Console.Out.Flush();
                    }
                    else if (cmd == "MOVE" && parts.Length >= 3)
                    {
                        int x = int.Parse(parts[1]);
                        int y = int.Parse(parts[2]);
                        SetCursorPos(x, y);
                    }
                    else if (cmd == "DOWN" && parts.Length >= 2)
                    {
                        string btn = parts[1].ToLowerInvariant();
                        if (btn == "left") SendMouseInput(MOUSEEVENTF_LEFTDOWN);
                        else if (btn == "right") SendMouseInput(MOUSEEVENTF_RIGHTDOWN);
                        else if (btn == "middle") SendMouseInput(MOUSEEVENTF_MIDDLEDOWN);
                    }
                    else if (cmd == "UP" && parts.Length >= 2)
                    {
                        string btn = parts[1].ToLowerInvariant();
                        if (btn == "left") SendMouseInput(MOUSEEVENTF_LEFTUP);
                        else if (btn == "right") SendMouseInput(MOUSEEVENTF_RIGHTUP);
                        else if (btn == "middle") SendMouseInput(MOUSEEVENTF_MIDDLEUP);
                    }
                    else if (cmd == "CLICK" && parts.Length >= 2)
                    {
                        string btn = parts[1].ToLowerInvariant();
                        if (btn == "left")
                        {
                            SendMouseInput(MOUSEEVENTF_LEFTDOWN);
                            Thread.Sleep(10);
                            SendMouseInput(MOUSEEVENTF_LEFTUP);
                        }
                        else if (btn == "right")
                        {
                            SendMouseInput(MOUSEEVENTF_RIGHTDOWN);
                            Thread.Sleep(10);
                            SendMouseInput(MOUSEEVENTF_RIGHTUP);
                        }
                        else if (btn == "middle")
                        {
                            SendMouseInput(MOUSEEVENTF_MIDDLEDOWN);
                            Thread.Sleep(10);
                            SendMouseInput(MOUSEEVENTF_MIDDLEUP);
                        }
                    }
                    else if (cmd == "DBLCLICK")
                    {
                        SendMouseInput(MOUSEEVENTF_LEFTDOWN);
                        Thread.Sleep(10);
                        SendMouseInput(MOUSEEVENTF_LEFTUP);
                        Thread.Sleep(50);
                        SendMouseInput(MOUSEEVENTF_LEFTDOWN);
                        Thread.Sleep(10);
                        SendMouseInput(MOUSEEVENTF_LEFTUP);
                    }
                    else if (cmd == "WHEEL" && parts.Length >= 2)
                    {
                        int delta = int.Parse(parts[1]);
                        SendMouseInput(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta);
                    }
                    else if (cmd == "KEYDOWN" && parts.Length >= 2)
                    {
                        ushort vk = ushort.Parse(parts[1]);
                        SendKeyboardInput(vk, 0);
                    }
                    else if (cmd == "KEYUP" && parts.Length >= 2)
                    {
                        ushort vk = ushort.Parse(parts[1]);
                        SendKeyboardInput(vk, KEYEVENTF_KEYUP);
                    }
                    else if (cmd == "TYPE" && parts.Length >= 2)
                    {
                        string text = line.Substring(5);
                        foreach (char c in text)
                        {
                            SendUnicodeChar(c);
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("ERR: " + ex.Message);
                }
            }
        }
    }
}
