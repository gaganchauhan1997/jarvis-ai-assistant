import { useState, useEffect, useCallback, useRef } from "react";

  interface UseSpeechRecognitionOptions {
    onResult?: (text: string, isFinal: boolean) => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  }

  export function useSpeechRecognition({ onResult, onEnd, onError }: UseSpeechRecognitionOptions = {}) {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState("");
    const recognitionRef = useRef<any>(null);

    // Use refs for callbacks so the recognition instance is never torn down when callbacks change
    const onResultRef = useRef(onResult);
    const onEndRef = useRef(onEnd);
    const onErrorRef = useRef(onError);

    useEffect(() => {
      onResultRef.current = onResult;
      onEndRef.current = onEnd;
      onErrorRef.current = onError;
    });

    useEffect(() => {
      if (typeof window === "undefined") return;

      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn("SpeechRecognition is not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        setTranscript(currentText);
        onResultRef.current?.(currentText, !!finalTranscript);
      };

      recognition.onerror = (event: any) => {
        // Ignore "aborted" — that's triggered by our own stopRecording()
        if (event.error === "aborted") return;
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        onErrorRef.current?.(event.error as string);
      };

      recognition.onend = () => {
        setIsRecording(false);
        onEndRef.current?.();
      };

      recognitionRef.current = recognition;

      return () => {
        recognitionRef.current?.abort();
      };
    }, []); // Empty deps: set up once, use refs for callbacks

    const startRecording = useCallback(() => {
      if (recognitionRef.current) {
        try {
          setTranscript("");
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (err) {
          console.error(err);
        }
      }
    }, []);

    const stopRecording = useCallback(() => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    }, [isRecording]);

    return {
      isRecording,
      transcript,
      startRecording,
      stopRecording,
    };
  }
  