# AGENTS.md

## О проекте

Это MVP приложения для бронирования слотов в календаре.

Основной стек:

- frontend: Vite, React, TypeScript в строгом режиме, Tailwind CSS, shadcn/ui;
- контракт API: TypeSpec;
- OpenAPI: генерируется из TypeSpec;
- mock API: Prism CLI;
- инструменты Codex: shadcn MCP подключен только для этого проекта через `.codex/config.toml`.

## Структура репозитория

- `frontend/` - Vite React frontend.
- `typeSpec/` - TypeSpec-контракт API.
- `docs/mvp-functional-spec.md` - функциональная спецификация MVP.
- `.codex/config.toml` - проектная конфигурация MCP для Codex.

## Команды

Запуск frontend:

```bash
npm run dev:frontend -- -- --host 127.0.0.1
```

Сборка frontend:

```bash
npm run build:frontend
```

Линтинг frontend:

```bash
npm run lint:frontend
```

Генерация OpenAPI из TypeSpec:

```bash
npm run openapi:generate
```

Запуск Prism mock API:

```bash
npm run mock:api
```

## Правила разработки

- Код frontend держать в `frontend/`.
- Изменения API-контракта держать в `typeSpec/main.tsp`.
- Сгенерированный OpenAPI-файл не редактировать вручную.
- Не использовать `any`, если можно описать точный TypeScript-тип.
- UI-компоненты shadcn/ui хранить в `frontend/src/components/ui/`.
- Новые shadcn/ui-компоненты добавлять через shadcn CLI или проектный shadcn MCP.
- Во frontend использовать относительные API-пути: `/public/*` и `/admin/*`.
- Бизнес-правила backend не переносить во frontend; frontend-валидация нужна только для базовой UX-проверки.

## Проверка изменений

Перед сообщением о завершении изменений запускать релевантные проверки:

```bash
npm run build:frontend
npm run lint:frontend
npm run openapi:generate
```

Если менялась генерация API или mock API, также проверить Prism:

```bash
npm run mock:api
```

И проверить хотя бы один endpoint, например:

```bash
curl http://127.0.0.1:4010/public/owner
```

## Процессы

- Не оставлять Vite или Prism запущенными в фоне без явной просьбы пользователя.
- Если dev server запускался для проверки, сообщить URL и указать, остался ли сервер запущенным.
- Для остановки процессов сначала использовать обычное завершение, а принудительное завершение применять только если обычное не сработало.
