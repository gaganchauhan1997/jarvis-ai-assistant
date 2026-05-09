import React, { useState, useCallback, useRef } from "react";
  import { useQueryClient } from "@tanstack/react-query";
  import { Mic, MicOff, Copy, Check, TerminalSquare, Loader2, Trash2, Activity, List, Settings } from "lucide-react";
  import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
  import { 
    useProcessDictation, 
    useGetDictationHistory, 
    getGetDictationHistoryQueryKey,
    useSaveDictation,
    useDeleteDictation,
    useGetDictationStats,
    getGetDictationStatsQueryKey
  } from "@workspace/api-client-react";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";
  import { ScrollArea } from "@/components/ui/scroll-area";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Skeleton } from "@/components/ui/skeleton";
  import { useToast } from "@/hooks/use-toast";
  import { DictationInputMode } from "@workspace/api-client-react";

  const ERROR_LABELS: Record<string, string> = {
    "not-allowed": "Microphone access denied. Please allow microphone permissions and try again.",
    "no-speech": "No speech detected. Please speak clearly and try again.",
    "network": "Network error. Please check your connection and try again.",
    "audio-capture": "No microphone found. Please connect a microphone.",
    "service-not-allowed": "Speech service not allowed. Try using Chrome browser.",
  };

  export default function Home() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [mode, setMode] = useState<DictationInputMode>("clean");
    const [copied, setCopied] = useState(false);
    const [activeResult, setActiveResult] = useState<{ rawText: string; processedText: string; mode: string } | null>(null);
    const resultRef = useRef<HTMLDivElement>(null);
    const transcriptRef = useRef("");

    const { data: history = [], isLoading: historyLoading } = useGetDictationHistory({
      query: { queryKey: getGetDictationHistoryQueryKey() }
    });
    
    const { data: stats, isLoading: statsLoading } = useGetDictationStats({
      query: { queryKey: getGetDictationStatsQueryKey() }
    });

    const processDictation = useProcessDictation();
    const saveDictation = useSaveDictation();
    const deleteDictation = useDeleteDictation();

    const processTranscription = useCallback(async (rawText: string) => {
      try {
        const result = await processDictation.mutateAsync({ data: { rawText, mode } });
        setActiveResult({ rawText, processedText: result.processedText, mode: result.mode });
        await saveDictation.mutateAsync({ data: { rawText, processedText: result.processedText, mode: result.mode } });
        queryClient.invalidateQueries({ queryKey: getGetDictationHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDictationStatsQueryKey() });
        if (resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth" });
      } catch (error) {
        toast({ title: "Processing Failed", description: "Could not process transcription.", variant: "destructive" });
      }
    }, [mode, processDictation, saveDictation, queryClient, toast]);

    const handleSpeechResult = useCallback((text: string, _isFinal: boolean) => {
      transcriptRef.current = text;
    }, []);

    const handleSpeechEnd = useCallback(() => {
      const text = transcriptRef.current.trim();
      if (text) processTranscription(text);
    }, [processTranscription]);

    const handleSpeechError = useCallback((err: string) => {
      const description = ERROR_LABELS[err] ?? `Recognition error: ${err}`;
      toast({ title: "Speech Recognition Error", description, variant: "destructive" });
    }, [toast]);

    const { isRecording, transcript, startRecording, stopRecording } = useSpeechRecognition({
      onResult: handleSpeechResult,
      onEnd: handleSpeechEnd,
      onError: handleSpeechError,
    });

    const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    };

    const handleDelete = async (id: number) => {
      try {
        await deleteDictation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: getGetDictationHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDictationStatsQueryKey() });
        toast({ title: "Deleted entry" });
      } catch (error) {
        toast({ title: "Delete Failed", variant: "destructive" });
      }
    };

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row dark">
        <main className="flex-1 p-6 md:p-12 flex flex-col space-y-8 max-w-4xl mx-auto w-full">
          <header className="flex items-center space-x-3">
            <TerminalSquare className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight text-primary font-mono uppercase">JARVIS // Voice AI</h1>
          </header>

          <section className="space-y-6">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8 flex flex-col items-center justify-center space-y-8">
                <div className="w-full flex justify-end">
                  <Select value={mode} onValueChange={(val: any) => setMode(val)}>
                    <SelectTrigger className="w-[180px] bg-background border-primary/20">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clean">Clean & Fix</SelectItem>
                      <SelectItem value="rephrase">Rephrase</SelectItem>
                      <SelectItem value="bullets">Bullet Points</SelectItem>
                      <SelectItem value="assistant">Assistant Response</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  {isRecording && (
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                  )}
                  <Button
                    size="lg"
                    variant={isRecording ? "destructive" : "default"}
                    className={`w-32 h-32 rounded-full flex flex-col items-center justify-center space-y-2 transition-all duration-300 ${isRecording ? 'animate-pulse' : 'hover:scale-105'}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={processDictation.isPending}
                  >
                    {isRecording ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
                    <span className="font-mono text-sm tracking-widest">{isRecording ? 'RELEASE' : 'HOLD'}</span>
                  </Button>
                </div>

                <div className="min-h-[60px] w-full text-center font-mono text-lg text-muted-foreground">
                  {isRecording ? (
                    <span className="text-primary">{transcript || "Listening..."}</span>
                  ) : processDictation.isPending ? (
                    <span className="flex items-center justify-center space-x-2 text-primary animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </span>
                  ) : (
                    <span>System standby. Ready for input.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {activeResult && (
            <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500" ref={resultRef}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-mono text-primary flex items-center space-x-2">
                  <Activity className="w-5 h-5" />
                  <span>Result // {activeResult.mode}</span>
                </h2>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(activeResult.processedText)}>
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  Copy
                </Button>
              </div>
              <Card className="border-primary/20">
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs text-muted-foreground font-mono uppercase mb-2">Processed Output</h3>
                      <p className="text-lg whitespace-pre-wrap font-medium">{activeResult.processedText}</p>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <h3 className="text-xs text-muted-foreground font-mono uppercase mb-2">Original Transcript</h3>
                      <p className="text-sm text-muted-foreground italic">{activeResult.rawText}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </main>

        <aside className="w-full md:w-[400px] border-l border-border bg-card/30 p-6 flex flex-col h-screen sticky top-0 overflow-hidden">
          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-mono text-primary flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Telemetry</span>
            </h2>
            {statsLoading ? (
              <div className="grid grid-cols-2 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
            ) : stats ? (
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-background border-border">
                  <CardContent className="p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground font-mono uppercase">Today</p>
                    <p className="text-2xl font-bold text-primary">{stats.todayDictations}</p>
                  </CardContent>
                </Card>
                <Card className="bg-background border-border">
                  <CardContent className="p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground font-mono uppercase">Words</p>
                    <p className="text-2xl font-bold text-primary">{stats.totalWords}</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <h2 className="text-lg font-mono text-primary mb-4 flex items-center space-x-2">
              <List className="w-5 h-5" />
              <span>History</span>
            </h2>
            <ScrollArea className="flex-1 pr-4">
              {historyLoading ? (
                <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : history.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground font-mono text-sm border border-dashed border-border rounded-lg">
                  No telemetry data available.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry, i) => (
                    <Card
                      key={entry.id}
                      className="bg-background border-border hover:border-primary/50 transition-colors animate-in fade-in slide-in-from-right-4 group"
                      style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                    >
                      <CardContent className="p-4 relative">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="text-[10px] font-mono border-primary/20 text-primary">
                            {entry.mode}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm line-clamp-3">{entry.processedText}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-2">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </aside>
      </div>
    );
  }
  