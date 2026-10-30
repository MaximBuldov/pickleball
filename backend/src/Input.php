<?php

declare(strict_types=1);

namespace App;

use Psr\Http\Message\ServerRequestInterface;

/** Small helpers for reading and validating request input. */
final class Input
{
    public static function body(ServerRequestInterface $request): array
    {
        $body = $request->getParsedBody();
        return is_array($body) ? $body : [];
    }

    public static function string(array $data, string $key, int $maxLength = 100): string
    {
        $value = trim((string) ($data[$key] ?? ''));
        if ($value === '') {
            throw HttpError::badRequest("Field \"$key\" is required");
        }
        if (mb_strlen($value) > $maxLength) {
            throw HttpError::badRequest("Field \"$key\" is too long");
        }
        return $value;
    }

    public static function int(array $data, string $key): int
    {
        $value = $data[$key] ?? null;
        if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
            throw HttpError::badRequest("Field \"$key\" must be a whole number");
        }
        return (int) $value;
    }

    /** @return int[] */
    public static function intList(array $data, string $key): array
    {
        $value = $data[$key] ?? null;
        if (!is_array($value)) {
            throw HttpError::badRequest("Field \"$key\" must be a list");
        }
        return array_map(function ($v) use ($key) {
            if (!is_int($v)) {
                throw HttpError::badRequest("Field \"$key\" must contain player ids");
            }
            return $v;
        }, array_values($value));
    }

    public static function date(?string $value, string $field = 'date'): string
    {
        if ($value === null || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            throw HttpError::badRequest("Field \"$field\" must be a date like 2026-10-30");
        }
        return $value;
    }

    public static function optionalDate(array $query, string $key): ?string
    {
        $value = $query[$key] ?? '';
        return $value === '' ? null : self::date($value, $key);
    }
}
