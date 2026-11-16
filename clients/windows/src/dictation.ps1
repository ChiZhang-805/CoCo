param([string] $WaveFile)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Globalization;
using System.Linq;
using System.Speech.Recognition;
using System.Text;
using System.Threading;

public static class CoCoDictation {
    public static void Listen(string waveFile) {
        var installed = SpeechRecognitionEngine.InstalledRecognizers();
        var language = installed.FirstOrDefault(r => r.Culture.Equals(CultureInfo.CurrentCulture))
            ?? installed.FirstOrDefault(r => r.Culture.Equals(CultureInfo.CurrentUICulture))
            ?? installed.FirstOrDefault();
        if (language == null) { Console.WriteLine("error language"); return; }
        using (var engine = new SpeechRecognitionEngine(language))
        using (var finished = new ManualResetEvent(false)) {
            try { engine.LoadGrammar(new DictationGrammar()); }
            catch { Console.WriteLine("error language"); return; }
            try {
                if (String.IsNullOrEmpty(waveFile)) engine.SetInputToDefaultAudioDevice();
                else engine.SetInputToWaveFile(waveFile);
            } catch { Console.WriteLine("error microphone"); return; }
            engine.SpeechRecognized += (s, e) => {
                if (!String.IsNullOrWhiteSpace(e.Result.Text))
                    Console.WriteLine("text " + Convert.ToBase64String(Encoding.UTF8.GetBytes(e.Result.Text)));
            };
            engine.RecognizeCompleted += (s, e) => {
                if (e.Error != null) Console.WriteLine("error recognition");
                finished.Set();
            };
            engine.RecognizeAsync(RecognizeMode.Multiple);
            Console.WriteLine("ready " + language.Culture.Name);
            if (String.IsNullOrEmpty(waveFile)) {
                var controls = new Thread(() => {
                    var command = Console.ReadLine();
                    if (command == null) Environment.Exit(0);
                    try { engine.RecognizeAsyncStop(); }
                    catch (InvalidOperationException) { }
                });
                controls.IsBackground = true;
                controls.Start();
            }
            finished.WaitOne();
        }
    }
}
'@
[CoCoDictation]::Listen($WaveFile)
