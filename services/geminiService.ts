import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

// Ensure API_KEY is accessed correctly.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY не определен. Пожалуйста, установите переменную окружения process.env.API_KEY.");
  // alert("API_KEY не определен. Функциональность будет ограничена."); // Consider a more user-facing warning if appropriate
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" }); 

// Тип для возвращаемого значения из inferSpeakerNames
type SpeakerNameSuggestions = { [key: string]: string };

// Тип для истории чата, используемый в ChatSection для отображения
export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

let currentChat: Chat | null = null;
let currentTranscriptContextForChat: string | null = null;


export const transcribeAudioOrVideo = async (dataUrl: string): Promise<string> => {
  if (!API_KEY) throw new Error("Ключ API Gemini не настроен.");
  
  const [header, base64Data] = dataUrl.split(',');
  if (!header || !base64Data) {
    throw new Error('Неверный формат URL данных. Не удалось разделить заголовок и данные.');
  }
  
  const mimeTypeMatch = header.match(/data:(.*?);base64/);
  if (!mimeTypeMatch || !mimeTypeMatch[1]) {
    throw new Error('Не удалось извлечь MIME-тип из URL данных.');
  }
  const mimeType = mimeTypeMatch[1];

  const mediaPart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Data,
    },
  };

  const textPart = {
    text: `Транскрибируйте речь из предоставленного аудио- или видеофайла.
Основные требования:
1.  **Формат вывода**: Каждая реплика должна быть на новой строке и иметь следующий формат: \`[ЧЧ:ММ:СС] Диктор X: Текст реплики.\` где ЧЧ:ММ:СС - временная метка начала реплики. Если возможно, используйте миллисекунды для большей точности, например \`[ЧЧ:ММ:СС.мс]\`. Если временные метки недоступны, используйте только идентификаторы дикторов.
2.  **Определение дикторов**: Определите разных дикторов и обозначьте их последовательно как 'Диктор А', 'Диктор Б', 'Диктор В' и т.д.
3.  **Точность**: Предоставьте максимально подробную и точную транскрипцию.
4.  **Видео**: Если файл является видео, транскрибируйте только аудиоконтент.
5.  **Нет дикторов**: Если дикторов не удается различить, предоставьте транскрипцию с временными метками (если доступны), но без идентификаторов дикторов, например: \`[ЧЧ:ММ:СС] Текст реплики.\` или просто \`Текст реплики.\` если метки недоступны.
Пожалуйста, строго придерживайтесь указанного формата вывода для каждой реплики. Ответ должен быть только транскрипцией.`,
  };

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', 
      contents: { parts: [textPart, mediaPart] },
       config: { thinkingConfig: { thinkingBudget: 0 } } 
    });
    return response.text;
  } catch (error) {
    console.error('Ошибка транскрипции аудио/видео:', error);
    if (error instanceof Error) {
        if (error.message.includes("API key not valid")) {
            throw new Error("Неверный ключ API Gemini. Пожалуйста, проверьте вашу конфигурацию.");
        }
        if (error.message.includes("quota")) {
             throw new Error("Превышена квота использования API Gemini. Пожалуйста, проверьте ваш тарифный план или попробуйте позже.");
        }
         throw new Error(`Ошибка транскрипции: ${error.message}`);
    }
    throw new Error('Транскрипция не удалась из-за неизвестной ошибки.');
  }
};

export const inferSpeakerNames = async (transcript: string): Promise<SpeakerNameSuggestions> => {
  if (!API_KEY) throw new Error("Ключ API Gemini не настроен для определения имен.");
  if (!transcript || transcript.trim() === "") {
    return {}; 
  }

  const prompt = `
Проанализируй следующую транскрипцию. В транскрипции дикторы обозначены как "Диктор А", "Диктор Б" и т.д. (иногда с временными метками перед ними, например "[00:00:05] Диктор А:").
Твоя задача - попытаться определить настоящие имена этих дикторов, если они упоминаются в диалоге (например, один диктор обращается к другому по имени).

Верни результат в формате JSON. Ключами в JSON должны быть исходные идентификаторы дикторов (например, "Диктор А"). 
Значениями должны быть предложенные имена. 
Если для какого-то диктора имя не удалось определить из контекста, используй его исходный идентификатор в качестве значения (например, "Диктор А": "Диктор А").
Убедись, что ответ является валидным JSON объектом. Ответ должен содержать ТОЛЬКО JSON, без каких-либо дополнительных пояснений или текста.

Пример:
Если транскрипция:
"[00:00:05] Диктор А: Привет, Иван! Как дела?
[00:00:08] Диктор Б: Привет, Анна! Все отлично. А у тебя, Диктор А?"

Ожидаемый JSON:
{
  "Диктор А": "Анна",
  "Диктор Б": "Иван"
}

Если транскрипция:
"[00:01:15] Диктор А: Сегодня хорошая погода.
[00:01:18] Диктор Б: Да, согласен."

Ожидаемый JSON:
{
  "Диктор А": "Диктор А",
  "Диктор Б": "Диктор Б"
}

Транскрипция для анализа:
---
${transcript}
---
JSON ответ:
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', 
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedNames: SpeakerNameSuggestions = JSON.parse(jsonStr);
    return parsedNames;

  } catch (error) {
    console.error('Ошибка при определении имен дикторов:', error);
     let detailedErrorMessage = `Не удалось обработать ответ от API для определения имен.`;
    if (error instanceof Error) {
        detailedErrorMessage += ` Детали: ${error.message}`;
    }
    if (error && typeof error === 'object' && 'message' in error) {
       if (String(error.message).includes("API key not valid")) {
            throw new Error("Неверный ключ API Gemini для определения имен. Пожалуйста, проверьте вашу конфигурацию.");
        }
        if (String(error.message).includes("quota")) {
             throw new Error("Превышена квота использования API Gemini для определения имен. Пожалуйста, проверьте ваш тарифный план или попробуйте позже.");
        }
    }
    throw new Error(detailedErrorMessage);
  }
};


export const summarizeText = async (textToSummarize: string): Promise<string> => {
  if (!API_KEY) throw new Error("Ключ API Gemini не настроен.");
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17', 
      contents: `Пожалуйста, предоставьте краткое резюме следующей транскрипции **в формате Markdown**.
Используйте следующие элементы Markdown для структурирования ответа:
- Заголовки (например, \`## Ключевые моменты\`, \`### Решения\`)
- Списки (маркированные \`* \` или \`- \` или нумерованные \`1. \`)
- Выделение текста (\`**жирный**\` для акцентов, \`_курсив_\` при необходимости)

Выделите ключевые моменты, принятые решения (если были) и основные пункты действий.
Если в транскрипции указаны дикторы (например, "[00:00:05] Иван:", "Мария:", "Диктор А:"), постарайся приписать им ключевые моменты в резюме, используя предоставленные имена.

Транскрипция:
---
${textToSummarize}
---
Ответ должен содержать только само резюме в формате Markdown, без каких-либо вводных или заключительных фраз типа "Вот резюме:".`,
    });
    return response.text;
  } catch (error) {
    console.error('Ошибка создания резюме:', error);
     if (error instanceof Error) {
        if (error.message.includes("API key not valid")) {
            throw new Error("Неверный ключ API Gemini. Пожалуйста, проверьте вашу конфигурацию.");
        }
        if (error.message.includes("quota")) {
             throw new Error("Превышена квота использования API Gemini для создания резюме. Пожалуйста, проверьте ваш тарифный план или попробуйте позже.");
        }
        throw new Error(`Ошибка создания резюме: ${error.message}`);
    }
    throw new Error('Создание резюме не удалось из-за неизвестной ошибки.');
  }
};

export const chatWithTranscriptContext = async (
  transcript: string,
  newMessage: string
): Promise<string> => {
  if (!API_KEY) throw new Error("Ключ API Gemini не настроен для чата.");
  if (!transcript || transcript.trim() === "") {
    throw new Error("Контекст транскрипции отсутствует для чата.");
  }
  if (!newMessage || newMessage.trim() === "") {
    throw new Error("Сообщение пользователя не может быть пустым.");
  }

  // Если контекст транскрипции изменился или чат еще не инициализирован, создаем новый чат
  if (transcript !== currentTranscriptContextForChat || !currentChat) {
    currentTranscriptContextForChat = transcript;
    const systemInstruction = `Ты — полезный ассистент. Тебе предоставлена следующая транскрипция аудиозаписи.
Твоя задача — отвечать на вопросы пользователя, основываясь ИСКЛЮЧИТЕЛЬНО на информации из этой транскрипции.
Не используй внешние знания или информацию, не содержащуюся в тексте.
Если ответ на вопрос не может быть найден в транскрипции, сообщи об этом пользователю (например: "Извините, я не могу найти ответ на этот вопрос в предоставленной транскрипции."). Не придумывай информацию.
Отвечай кратко и по существу.

ТРАНСКРИПЦИЯ:
---
${transcript}
---
`;
    currentChat = ai.chats.create({
      model: 'gemini-2.5-flash-preview-04-17',
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } // Low latency for chat
      },
      // history: [] // Начинаем с пустой истории, так как контекст задан через systemInstruction
    });
  }

  try {
    // Гарантируем, что currentChat не null (TS type guard)
    if (!currentChat) {
        // Эта ситуация не должна возникать из-за логики выше, но для безопасности:
        throw new Error("Экземпляр чата не был инициализирован.");
    }
    const response: GenerateContentResponse = await currentChat.sendMessage({message: newMessage});
    return response.text;
  } catch (error) {
    console.error('Ошибка в чате с контекстом:', error);
    // При ошибке можно сбросить чат, чтобы следующая попытка его пересоздала
    currentChat = null;
    currentTranscriptContextForChat = null;
    if (error instanceof Error) {
      if (error.message.includes("API key not valid")) {
        throw new Error("Неверный ключ API Gemini для чата. Пожалуйста, проверьте вашу конфигурацию.");
      }
      if (error.message.includes("quota")) {
        throw new Error("Превышена квота использования API Gemini для чата. Пожалуйста, проверьте ваш тарифный план или попробуйте позже.");
      }
      throw new Error(`Ошибка чата: ${error.message}`);
    }
    throw new Error('Чат не удался из-за неизвестной ошибки.');
  }
};
