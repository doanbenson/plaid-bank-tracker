'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { tradingApi } from '@/lib/api-client'

interface StockChartProps {
  defaultSymbol?: string
}

export function StockChart({ defaultSymbol = 'SPY' }: StockChartProps) {
  const [symbol, setSymbol] = useState(defaultSymbol)
  const [inputSymbol, setInputSymbol] = useState(defaultSymbol)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<string>('1Day')
  const [days, setDays] = useState<number>(30)

  useEffect(() => {
    fetchData()
  }, [symbol, timeframe, days])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await tradingApi.getMarketData(symbol, timeframe, days)
      const formattedData = response.data.map((item: any) => ({
        ...item,
        date: new Date(item.timestamp).toLocaleDateString(),
      }))
      setData(formattedData)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch market data')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    if (inputSymbol) {
      setSymbol(inputSymbol.toUpperCase())
    }
  }

  const timeframeOptions = [
    { label: '1D', value: '1Day', days: 30 },
    { label: '1H', value: '1Hour', days: 7 },
    { label: '15M', value: '15Min', days: 3 },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{symbol} Chart</CardTitle>
            <CardDescription>Historical price data</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Symbol"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-32"
            />
            <Button onClick={handleSearch} size="sm">
              Load
            </Button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          {timeframeOptions.map((option) => (
            <Button
              key={option.value}
              variant={timeframe === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTimeframe(option.value)
                setDays(option.days)
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-400px">
            <p className="text-muted-foreground">Loading chart data...</p>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-400px">
            <p className="text-red-500">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-400px">
            <p className="text-muted-foreground">No data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: 'none' }}
                labelStyle={{ color: 'white' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="close" 
                stroke="#8884d8" 
                strokeWidth={2}
                dot={false}
                name="Close Price"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
